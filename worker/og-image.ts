import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode';
import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
import { bboxOf } from '../src/geo/web-mercator.ts';
import { computeProjection, routeCoords } from './og-projection.ts';
import { buildTileGrid } from './tile-grid.ts';
import { buildOverlaySvg } from './overlay-svg.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const PANEL_WIDTH = 450;
const PADDING = 50;
const TILE_STYLE = 'topo-v2';

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = Promise.all([
      initWasm(resvgWasm as WebAssembly.Module).catch((err) => {
        if (err instanceof Error && err.message.includes('Already initialized'))
          return;
        throw err;
      }),
      initJpeg(jpegWasm as WebAssembly.Module).catch((err) => {
        if (err instanceof Error && err.message.includes('Already initialized'))
          return;
        throw err;
      }),
    ]).then(() => undefined);
  }
  return wasmReady;
}

let fontsCache: Uint8Array[] | null = null;
async function loadFonts(env: Env, origin: string): Promise<Uint8Array[]> {
  if (fontsCache) return fontsCache;
  const fetchAsset = async (path: string): Promise<Uint8Array> => {
    const res = await env.ASSETS.fetch(new Request(origin + path));
    if (!res.ok) throw new Error(`font fetch ${res.status}: ${path}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  fontsCache = await Promise.all([
    fetchAsset('/fonts/inter-regular.woff2'),
    fetchAsset('/fonts/inter-bold.woff2'),
  ]);
  return fontsCache;
}

const routeBbox = bboxOf(routeCoords);

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function formatDuration(sec: number): string {
  if (sec < 0) return '—';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export interface DeltaInfo {
  text: string;
  label: string;
  kind: 'ahead' | 'behind' | 'neutral';
}

function formatDelta(deltaSec: number | null): DeltaInfo {
  if (deltaSec === null)
    return { text: '—', label: 'vs 2022', kind: 'neutral' };
  if (deltaSec >= 0) {
    return {
      text: formatDuration(deltaSec),
      label: 'Ahead of 2022',
      kind: 'ahead',
    };
  }
  return {
    text: formatDuration(-deltaSec),
    label: 'Behind 2022',
    kind: 'behind',
  };
}

function bufferToBase64(buf: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

async function fetchTile(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    cf: {
      cacheTtl: 86400,
      cacheEverything: true,
    },
  } as RequestInit);
  if (!res.ok) throw new Error(`tile fetch ${res.status}: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function renderOgImage(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lonStr = url.searchParams.get('lon');
  const tStr = url.searchParams.get('t');

  const lat = latStr ? parseFloat(latStr) : null;
  const lon = lonStr ? parseFloat(lonStr) : null;
  const tMs = tStr ? Date.parse(tStr) : NaN;

  if (
    lat === null ||
    lon === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(tMs)
  ) {
    return new Response('Missing or invalid lat/lon/t', { status: 400 });
  }

  const proj = computeProjection(lat, lon, tMs);

  const grid = buildTileGrid({
    bbox: routeBbox,
    width: WIDTH,
    height: HEIGHT,
    fitWidth: WIDTH - PANEL_WIDTH,
    fitHeight: HEIGHT,
    padding: PADDING,
    centerAt: { x: PANEL_WIDTH + (WIDTH - PANEL_WIDTH) / 2, y: HEIGHT / 2 },
    style: TILE_STYLE,
    maptilerKey: env.VITE_MAPTILER_KEY,
    zoomBias: 1,
  });

  const tileBuffers = await Promise.all(
    grid.tiles.map((t) => fetchTile(t.url)),
  );
  const tileDataUrls = tileBuffers.map(
    (buf) => 'data:image/png;base64,' + bufferToBase64(buf),
  );

  const svg = buildOverlaySvg({
    width: WIDTH,
    height: HEIGHT,
    grid,
    tileDataUrls,
    fullRouteCoords: routeCoords,
    doneCoords: proj.doneCoords,
    pctText: formatPct(proj.pctComplete),
    walkingTimeText: formatDuration(proj.elapsedSec),
    delta: formatDelta(proj.delta2022Sec),
  });

  await ensureWasm();
  const fonts = await loadFonts(env, url.origin);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontBuffers: fonts,
      defaultFontFamily: 'Inter',
      loadSystemFonts: false,
    },
  });

  const rendered = resvg.render();
  const body = await encodeJpeg(
    {
      data: new Uint8ClampedArray(rendered.pixels),
      width: rendered.width,
      height: rendered.height,
      colorSpace: 'srgb',
    },
    { quality: 60, auto_subsample: false, chroma_subsample: 1 },
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  });
}

export { formatPct, formatDuration, formatDelta };
