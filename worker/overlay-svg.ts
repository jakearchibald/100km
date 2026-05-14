import type { TileGrid } from './tile-grid.ts';
import type { DeltaInfo } from './og-image.ts';

const COLORS = {
  routeDim: '#f3bf31',
  routeDone: '#2e7d32',
  user: '#1e88e5',
  historic2022: '#fdd835',
  panelBg: 'rgba(0, 0, 0, 0.62)',
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

const PANEL_WIDTH = 500;

export interface OverlayInput {
  width: number;
  height: number;
  grid: TileGrid;
  tileDataUrls: readonly string[];
  fullRouteCoords: readonly (readonly [number, number])[];
  doneCoords: readonly (readonly [number, number])[];
  pctText: string;
  walkingTimeText: string;
  delta: DeltaInfo;
}

function tilesToSvg(grid: TileGrid, dataUrls: readonly string[]): string {
  return grid.tiles
    .map(
      (t, i) =>
        `<image x="${t.px.toFixed(2)}" y="${t.py.toFixed(2)}" width="${t.size.toFixed(2)}" height="${t.size.toFixed(2)}" href="${dataUrls[i]}" preserveAspectRatio="none"/>`,
    )
    .join('');
}

function coordsToPath(
  grid: TileGrid,
  coords: readonly (readonly [number, number])[],
): string {
  let d = '';
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const p = grid.toPixel(lon, lat);
    d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
  }
  return d;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statsPanel(
  height: number,
  pct: string,
  time: string,
  delta: DeltaInfo,
): string {
  const x0 = 0;
  const w = PANEL_WIDTH;
  const padX = 40;
  const blockSpacing = 168;
  const baseY = (height - blockSpacing * 2) / 2 + 20;

  function block(
    y: number,
    value: string,
    label: string,
    valueColor = COLORS.textPrimary,
  ): string {
    return (
      `<text x="${x0 + padX}" y="${y}" font-size="86" font-weight="700" fill="${valueColor}" font-family="Inter, sans-serif">${escapeXml(value)}</text>` +
      `<text x="${x0 + padX}" y="${y + 38}" font-size="26" fill="${COLORS.textSecondary}" font-family="Inter, sans-serif" letter-spacing="2">${escapeXml(label.toUpperCase())}</text>`
    );
  }

  return (
    `<rect x="${x0}" y="0" width="${w}" height="${height}" fill="${COLORS.panelBg}"/>` +
    block(baseY, pct, 'complete') +
    block(baseY + blockSpacing, time, 'walking') +
    block(
      baseY + blockSpacing * 2,
      delta.text,
      delta.label,
      deltaColor(delta.kind),
    )
  );
}

export function buildOverlaySvg(input: OverlayInput): string {
  const {
    width,
    height,
    grid,
    tileDataUrls,
    fullRouteCoords,
    doneCoords,
    pctText,
    walkingTimeText,
    delta,
  } = input;

  const fullPath = coordsToPath(grid, fullRouteCoords);
  const donePath = coordsToPath(grid, doneCoords);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#cfe1c8"/>` +
    tilesToSvg(grid, tileDataUrls) +
    `<path d="${fullPath}" stroke="#ffffff" stroke-width="30" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity="0.8"/>` +
    `<path d="${fullPath}" stroke="${COLORS.routeDim}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="none"/>` +
    `<path d="${donePath}" stroke="${COLORS.routeDone}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" fill="none"/>` +
    statsPanel(height, pctText, walkingTimeText, delta) +
    `</svg>`
  );
}
