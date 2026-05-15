import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { loadEnv } from 'vite';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { XMLParser } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';
import {
  bboxOf,
  lonLatToWorldPixel,
  exactFitZoom,
  TILE_SIZE,
} from '../src/geo/web-mercator.ts';

const VIRTUAL_ID = 'virtual:og-basemap';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const OUTPUT_FILENAME = 'og-basemap.png';
const PUBLIC_PATH = '/' + OUTPUT_FILENAME;

const WIDTH = 1200;
const HEIGHT = 630;
const PANEL_WIDTH_FIT = 450;
const PANEL_WIDTH_DRAW = 500;
const PADDING = 50;
const TILE_STYLE = 'topo-v2';
const ZOOM_BIAS = 1;
const BG_COLOR = '#cfe1c8';
const PANEL_COLOR_RGBA = 'rgba(0, 0, 0, 0.62)';

interface TileSpec {
  url: string;
  px: number;
  py: number;
  size: number;
}

interface Grid {
  tiles: TileSpec[];
  toPixel(lon: number, lat: number): { x: number; y: number };
}

function buildGrid(coords: readonly [number, number][], maptilerKey: string): Grid {
  const bbox = bboxOf(coords);

  const zFloat = exactFitZoom(
    bbox,
    WIDTH - PANEL_WIDTH_FIT,
    HEIGHT,
    PADDING,
  );
  const zTile = Math.min(18, Math.max(0, Math.ceil(zFloat) - 1 - ZOOM_BIAS));
  const tileScale = 2 ** (zFloat - zTile);
  const renderedTileSize = TILE_SIZE * tileScale;

  const tl = lonLatToWorldPixel(bbox.minLon, bbox.maxLat, zFloat);
  const br = lonLatToWorldPixel(bbox.maxLon, bbox.minLat, zFloat);

  const centerWorldX = (tl.x + br.x) / 2;
  const centerWorldY = (tl.y + br.y) / 2;
  const targetX = PANEL_WIDTH_FIT + (WIDTH - PANEL_WIDTH_FIT) / 2;
  const targetY = HEIGHT / 2;
  const originWorldX = centerWorldX - targetX;
  const originWorldY = centerWorldY - targetY;
  const tileStride = TILE_SIZE * tileScale;

  const minTileX = Math.floor(originWorldX / tileStride);
  const minTileY = Math.floor(originWorldY / tileStride);
  const maxTileX = Math.floor((originWorldX + WIDTH) / tileStride);
  const maxTileY = Math.floor((originWorldY + HEIGHT) / tileStride);

  const tiles: TileSpec[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tiles.push({
        url: `https://api.maptiler.com/maps/${TILE_STYLE}/256/${zTile}/${tx}/${ty}@2x.png?key=${maptilerKey}`,
        px: tx * tileStride - originWorldX,
        py: ty * tileStride - originWorldY,
        size: renderedTileSize,
      });
    }
  }

  return {
    tiles,
    toPixel(lon, lat) {
      const p = lonLatToWorldPixel(lon, lat, zFloat);
      return { x: p.x - originWorldX, y: p.y - originWorldY };
    },
  };
}

function bufferToBase64(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

async function fetchTile(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tile fetch ${res.status}: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function buildRoutePathAndCumPx(
  coords: readonly [number, number][],
  grid: Grid,
): {
  d: string;
  cumPx: number[];
  totalPx: number;
} {
  let d = '';
  const cumPx: number[] = new Array(coords.length);
  let acc = 0;
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const { x, y } = grid.toPixel(lon, lat);
    if (i === 0) {
      cumPx[0] = 0;
      d = `M${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      const dx = x - prevX;
      const dy = y - prevY;
      acc += Math.hypot(dx, dy);
      cumPx[i] = acc;
      d += `L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    prevX = x;
    prevY = y;
  }
  return { d, cumPx, totalPx: acc };
}

let wasmInitialized = false;
async function ensureWasm(root: string): Promise<void> {
  if (wasmInitialized) return;
  const wasmPath = resolve(
    root,
    'node_modules/@resvg/resvg-wasm/index_bg.wasm',
  );
  const wasmBytes = await readFile(wasmPath);
  try {
    await initWasm(wasmBytes);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('Already initialized'))) {
      throw err;
    }
  }
  wasmInitialized = true;
}

async function compositeBasemap(grid: Grid, root: string): Promise<Uint8Array> {
  const tileBuffers = await Promise.all(grid.tiles.map((t) => fetchTile(t.url)));
  const images = grid.tiles
    .map((t, i) => {
      const href = 'data:image/png;base64,' + bufferToBase64(tileBuffers[i]);
      return `<image x="${t.px.toFixed(2)}" y="${t.py.toFixed(2)}" width="${t.size.toFixed(2)}" height="${t.size.toFixed(2)}" href="${href}" preserveAspectRatio="none"/>`;
    })
    .join('');
  const panel = `<rect x="0" y="0" width="${PANEL_WIDTH_DRAW}" height="${HEIGHT}" fill="${PANEL_COLOR_RGBA}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG_COLOR}"/>` +
    images +
    panel +
    `</svg>`;

  await ensureWasm(root);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

interface BuiltData {
  png: Uint8Array;
  routePath: string;
  cumPx: number[];
  totalPx: number;
}

// Module-scoped so that the client + worker builds in the Cloudflare Vite
// plugin (which share a Node process) reuse a single tile fetch + composite.
let sharedBuildPromise: Promise<BuiltData> | null = null;

const KMZ_PATH = 'data/2026.kmz';
const MAIN_ROUTE_NAME = 'L2B 100km Route 2026_131125';
const ROUTES_FOLDER_NAME = 'L2B Routes';

interface RawCoord {
  coordinates?: string;
}
interface RawPlacemark {
  name?: string;
  LineString?: RawCoord;
}
interface RawFolder {
  name?: string;
  Placemark?: RawPlacemark | RawPlacemark[];
}
interface RawKml {
  kml: { Document: { Folder?: RawFolder | RawFolder[] } };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

async function loadRouteCoords(root: string): Promise<[number, number][]> {
  const buf = await readFile(resolve(root, KMZ_PATH));
  const files = unzipSync(new Uint8Array(buf));
  const docKml = files['doc.kml'];
  if (!docKml) throw new Error(`KMZ missing doc.kml: ${KMZ_PATH}`);
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
  const parsed = parser.parse(strFromU8(docKml)) as RawKml;
  const folders = asArray(parsed.kml.Document.Folder);
  const routesFolder = folders.find((f) => f.name === ROUTES_FOLDER_NAME);
  if (!routesFolder) throw new Error(`KML missing folder: ${ROUTES_FOLDER_NAME}`);
  const pm = asArray(routesFolder.Placemark).find((p) => p.name === MAIN_ROUTE_NAME);
  const text = pm?.LineString?.coordinates;
  if (!text) throw new Error(`KML missing route LineString: ${MAIN_ROUTE_NAME}`);
  const out: [number, number][] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const parts = raw.split(',');
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push([lon, lat]);
  }
  if (out.length < 2) throw new Error('Route LineString has no usable coordinates');
  return out;
}

export default function viteOgBasemapPlugin(): Plugin {
  let maptilerKey = '';
  let config: ResolvedConfig;

  function buildOnce(): Promise<BuiltData> {
    if (!sharedBuildPromise) {
      if (!maptilerKey) {
        return Promise.reject(
          new Error('VITE_MAPTILER_KEY required for og-basemap build'),
        );
      }
      sharedBuildPromise = (async () => {
        const coords = await loadRouteCoords(config.root);
        const grid = buildGrid(coords, maptilerKey);
        const { d, cumPx, totalPx } = buildRoutePathAndCumPx(coords, grid);
        const png = await compositeBasemap(grid, config.root);
        return { png, routePath: d, cumPx, totalPx };
      })();
    }
    return sharedBuildPromise;
  }

  return {
    name: 'vite-plugin-og-basemap',
    configResolved(c) {
      config = c;
      const env = loadEnv(c.mode, c.root, 'VITE_');
      maptilerKey = env.VITE_MAPTILER_KEY ?? '';
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const data = await buildOnce();
      return (
        `export const basemapAssetPath = ${JSON.stringify(PUBLIC_PATH)};\n` +
        `export const routePath = ${JSON.stringify(data.routePath)};\n` +
        `export const cumPx = ${JSON.stringify(data.cumPx)};\n` +
        `export const totalPx = ${JSON.stringify(data.totalPx)};\n`
      );
    },
    configureServer(server) {
      server.middlewares.use(PUBLIC_PATH, async (_req, res, next) => {
        try {
          const data = await buildOnce();
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.end(Buffer.from(data.png));
        } catch (err) {
          next(err);
        }
      });
    },
    async generateBundle() {
      // Emit into the client build so it lands in dist/ for env.ASSETS to serve.
      // Skip in worker builds — those go to a different output dir.
      const envName = (this as { environment?: { name?: string } }).environment
        ?.name;
      if (envName && envName !== 'client') return;

      const data = await buildOnce();
      this.emitFile({
        type: 'asset',
        fileName: OUTPUT_FILENAME,
        source: data.png,
      });
    },
  };
}
