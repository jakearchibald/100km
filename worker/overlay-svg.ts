import { routePath, totalPx } from 'virtual:og-basemap';
import type { DeltaInfo } from './og-image.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const PANEL_WIDTH = 500;

const COLORS = {
  routeDim: '#f3bf31',
  routeDone: '#2e7d32',
  textPrimary: '#ffffff',
  textSecondary: '#cfd8dc',
  ahead: '#4caf50',
  behind: '#ef5350',
};

function deltaColor(kind: DeltaInfo['kind']): string {
  if (kind === 'ahead') return COLORS.ahead;
  if (kind === 'behind') return COLORS.behind;
  return COLORS.textPrimary;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Use a dasharray pattern that's larger than the path length, so the offscreen
// "off" segment never wraps back to start drawing again.
const DASH_OFF = totalPx + 100;

// Static fragment: the full dimmed route. The done overlay is the same path
// with stroke-dasharray controlling how much is drawn.
const ROUTE_BACKDROP =
  `<path d="${routePath}" stroke="#ffffff" stroke-width="30" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity="0.8"/>` +
  `<path d="${routePath}" stroke="${COLORS.routeDim}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;

const PANEL_PAD_X = 50;
const BLOCK_SPACING = 168;
const BLOCK_BASE_Y = (HEIGHT - BLOCK_SPACING * 2) / 2 + 10;

function block(
  y: number,
  value: string,
  label: string,
  valueColor: string,
): string {
  return (
    `<text x="${PANEL_PAD_X}" y="${y}" font-size="86" font-weight="700" fill="${valueColor}" font-family="Inter, sans-serif">${escapeXml(value)}</text>` +
    `<text x="${PANEL_PAD_X}" y="${y + 45}" font-size="35" fill="${COLORS.textSecondary}" font-family="Inter, sans-serif" letter-spacing="2">${escapeXml(label.toUpperCase())}</text>`
  );
}

const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`;
const SVG_CLOSE = `</svg>`;

export interface OverlayInput {
  basemapDataUrl: string;
  doneLengthPx: number;
  pctText: string;
  walkingTimeText: string;
  delta: DeltaInfo;
}

export function buildOverlaySvg(input: OverlayInput): string {
  const { basemapDataUrl, doneLengthPx, pctText, walkingTimeText, delta } =
    input;

  const basemap = `<image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" href="${basemapDataUrl}" preserveAspectRatio="none"/>`;

  const dash = Math.max(0, Math.min(totalPx, doneLengthPx));
  const donePath = `<path d="${routePath}" stroke="${COLORS.routeDone}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="none" stroke-dasharray="${dash.toFixed(1)} ${DASH_OFF}"/>`;

  const panel =
    block(BLOCK_BASE_Y, pctText, 'complete', COLORS.textPrimary) +
    block(
      BLOCK_BASE_Y + BLOCK_SPACING,
      walkingTimeText,
      'walking time',
      COLORS.textPrimary,
    ) +
    block(
      BLOCK_BASE_Y + BLOCK_SPACING * 2,
      delta.text,
      delta.label,
      deltaColor(delta.kind),
    );

  return (
    SVG_OPEN +
    basemap +
    ROUTE_BACKDROP +
    donePath +
    panel +
    SVG_CLOSE
  );
}

export { PANEL_WIDTH };
