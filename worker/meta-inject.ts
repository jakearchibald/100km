import { computeProjection } from './og-projection.ts';
import { formatDelta, formatDuration, formatPct } from './og-image.ts';

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMetaTags(canonicalUrl: string, ogImageUrl: string, lat: number, lon: number, tMs: number): string {
  const proj = computeProjection(lat, lon, tMs);
  const pct = formatPct(proj.pctComplete);
  const time = formatDuration(proj.elapsedSec);
  const delta = formatDelta(proj.delta2022Sec);

  const title = `${pct} complete · ${time}`;
  const description = delta.kind === 'neutral'
    ? 'London to Brighton 100km'
    : `${delta.text} ${delta.label.toLowerCase()} — London to Brighton 100km`;

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(ogImageUrl)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(ogImageUrl)}">`,
  ];
  return tags.join('');
}

export async function injectOgMeta(req: Request, env: Env): Promise<Response> {
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
    return env.ASSETS.fetch(req);
  }

  const indexReq = new Request(new URL('/', req.url).toString(), req);
  const assetRes = await env.ASSETS.fetch(indexReq);
  const ct = assetRes.headers.get('content-type') ?? '';
  if (!ct.includes('text/html')) return assetRes;

  const imageUrl = new URL('/og-image.jpg', req.url);
  imageUrl.searchParams.set('lat', lat.toFixed(6));
  imageUrl.searchParams.set('lon', lon.toFixed(6));
  imageUrl.searchParams.set('t', new Date(tMs).toISOString());

  const metaHtml = buildMetaTags(req.url, imageUrl.toString(), lat, lon, tMs);

  return new HTMLRewriter()
    .on('meta[property^="og:"], meta[name^="twitter:"]', {
      element(el) {
        el.remove();
      },
    })
    .on('head', {
      element(el) {
        el.append(metaHtml, { html: true });
      },
    })
    .transform(assetRes);
}
