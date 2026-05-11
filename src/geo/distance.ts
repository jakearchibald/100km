const R = 6378137;
const DEG = Math.PI / 180;

export interface Equirect {
  midLat: number;
  midLon: number;
  mPerDegLat: number;
  mPerDegLon: number;
}

export function makeEquirect(midLat: number, midLon: number): Equirect {
  return {
    midLat,
    midLon,
    mPerDegLat: DEG * R,
    mPerDegLon: DEG * R * Math.cos(midLat * DEG),
  };
}

export function toXY(e: Equirect, lat: number, lon: number): [number, number] {
  return [(lon - e.midLon) * e.mPerDegLon, (lat - e.midLat) * e.mPerDegLat];
}
