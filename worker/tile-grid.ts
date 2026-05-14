import { exactFitZoom, lonLatToWorldPixel, TILE_SIZE, type Bbox } from '../src/geo/web-mercator.ts';

export interface TileSpec {
  z: number;
  x: number;
  y: number;
  url: string;
  px: number;
  py: number;
  /** Rendered size at the placement zoom — may differ from TILE_SIZE when fitting fractionally. */
  size: number;
}

export interface TileGrid {
  width: number;
  height: number;
  tiles: TileSpec[];
  toPixel(lon: number, lat: number): { x: number; y: number };
}

interface BuildOptions {
  bbox: Bbox;
  width: number;
  height: number;
  padding: number;
  style: string;
  maptilerKey: string;
  /** Canvas-pixel position where the bbox center should land. Defaults to canvas center. */
  centerAt?: { x: number; y: number };
  /** Width/height used for fitting the zoom level. Defaults to width/height. */
  fitWidth?: number;
  fitHeight?: number;
}

export function buildTileGrid({ bbox, width, height, padding, style, maptilerKey, centerAt, fitWidth, fitHeight }: BuildOptions): TileGrid {
  // Pick a fractional zoom that fits the bbox exactly in the usable area.
  const zFloat = exactFitZoom(bbox, fitWidth ?? width, fitHeight ?? height, padding);
  // Fetch tiles at the nearest higher integer zoom so they shrink (sharper) rather than stretch.
  const zTile = Math.min(18, Math.max(0, Math.ceil(zFloat)));
  // Scale factor applied to tiles when placing them on the canvas.
  const tileScale = 2 ** (zFloat - zTile);
  const renderedTileSize = TILE_SIZE * tileScale;

  const tl = lonLatToWorldPixel(bbox.minLon, bbox.maxLat, zFloat);
  const br = lonLatToWorldPixel(bbox.maxLon, bbox.minLat, zFloat);

  const centerWorldX = (tl.x + br.x) / 2;
  const centerWorldY = (tl.y + br.y) / 2;
  const targetX = centerAt?.x ?? width / 2;
  const targetY = centerAt?.y ?? height / 2;
  // Origin in "placement" world pixels (at zFloat scale).
  const originWorldX = centerWorldX - targetX;
  const originWorldY = centerWorldY - targetY;
  // Origin in tile-coordinate space (at zTile scale).
  const originTileX = originWorldX / tileScale;
  const originTileY = originWorldY / tileScale;

  const minTileX = Math.floor(originTileX / TILE_SIZE);
  const minTileY = Math.floor(originTileY / TILE_SIZE);
  const maxTileX = Math.floor((originTileX + width / tileScale) / TILE_SIZE);
  const maxTileY = Math.floor((originTileY + height / tileScale) / TILE_SIZE);

  const tiles: TileSpec[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tiles.push({
        z: zTile,
        x: tx,
        y: ty,
        url: `https://api.maptiler.com/maps/${style}/256/${zTile}/${tx}/${ty}.png?key=${maptilerKey}`,
        px: tx * TILE_SIZE * tileScale - originWorldX,
        py: ty * TILE_SIZE * tileScale - originWorldY,
        size: renderedTileSize,
      });
    }
  }

  return {
    width,
    height,
    tiles,
    toPixel(lon: number, lat: number) {
      const p = lonLatToWorldPixel(lon, lat, zFloat);
      return { x: p.x - originWorldX, y: p.y - originWorldY };
    },
  };
}
