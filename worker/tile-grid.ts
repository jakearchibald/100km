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
  /** Subtracted from the integer tile zoom — higher values fetch lower-detail tiles scaled up. */
  zoomBias?: number;
}

export function buildTileGrid({ bbox, width, height, padding, style, maptilerKey, centerAt, fitWidth, fitHeight, zoomBias = 0 }: BuildOptions): TileGrid {
  // Pick a fractional zoom that fits the bbox exactly in the usable area.
  const zFloat = exactFitZoom(bbox, fitWidth ?? width, fitHeight ?? height, padding);
  // @2x tiles are 512px covering the same ground as a 256px tile one zoom higher,
  // so fetch at ceil(zFloat) - 1 to get equivalent sharpness with 1/4 the requests.
  // zoomBias drops the tile zoom further, producing simpler/blurrier maps that get scaled up.
  const zTile = Math.min(18, Math.max(0, Math.ceil(zFloat) - 1 - zoomBias));
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
  // Tile coordinates address the same ground area whether @1x or @2x; only the
  // rendered pixel size differs. Stride in placement (zFloat) pixels:
  const tileStride = TILE_SIZE * tileScale;

  const minTileX = Math.floor(originWorldX / tileStride);
  const minTileY = Math.floor(originWorldY / tileStride);
  const maxTileX = Math.floor((originWorldX + width) / tileStride);
  const maxTileY = Math.floor((originWorldY + height) / tileStride);

  const tiles: TileSpec[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tiles.push({
        z: zTile,
        x: tx,
        y: ty,
        url: `https://api.maptiler.com/maps/${style}/256/${zTile}/${tx}/${ty}@2x.png?key=${maptilerKey}`,
        px: tx * tileStride - originWorldX,
        py: ty * tileStride - originWorldY,
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
