export const TILE_SIZE = 256;

export interface Pixel {
  x: number;
  y: number;
}

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function lonLatToWorldPixel(lon: number, lat: number, zoom: number): Pixel {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function bboxOf(coords: readonly (readonly [number, number])[]): Bbox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLat, maxLat, minLon, maxLon };
}

export function fitZoom(bbox: Bbox, width: number, height: number, padding = 0): number {
  for (let z = 18; z >= 0; z--) {
    const tl = lonLatToWorldPixel(bbox.minLon, bbox.maxLat, z);
    const br = lonLatToWorldPixel(bbox.maxLon, bbox.minLat, z);
    if (br.x - tl.x + padding * 2 <= width && br.y - tl.y + padding * 2 <= height) {
      return z;
    }
  }
  return 0;
}

/**
 * Computes the fractional zoom at which the bbox exactly fills the given area
 * (minus padding on each side). Snap with Math.floor / Math.ceil to pick a tile
 * fetch zoom; use the fractional value to scale and place those tiles.
 */
export function exactFitZoom(bbox: Bbox, width: number, height: number, padding = 0): number {
  const usableW = Math.max(1, width - padding * 2);
  const usableH = Math.max(1, height - padding * 2);
  const tl0 = lonLatToWorldPixel(bbox.minLon, bbox.maxLat, 0);
  const br0 = lonLatToWorldPixel(bbox.maxLon, bbox.minLat, 0);
  const widthAtZ0 = br0.x - tl0.x;
  const heightAtZ0 = br0.y - tl0.y;
  const zoomFromWidth = Math.log2(usableW / widthAtZ0);
  const zoomFromHeight = Math.log2(usableH / heightAtZ0);
  return Math.min(zoomFromWidth, zoomFromHeight);
}
