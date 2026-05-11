import { type Equirect, toXY } from './distance.ts';

export interface Projection {
  i: number;
  t: number;
  distM: number;
  lat: number;
  lon: number;
}

export function projectOntoPolyline(
  lat: number,
  lon: number,
  coords: readonly (readonly [number, number])[],
  cumDistM: readonly number[],
  e: Equirect,
): Projection {
  const [px, py] = toXY(e, lat, lon);
  let bestI = 0;
  let bestT = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const [ax, ay] = toXY(e, a[1], a[0]);
    const [bx, by] = toXY(e, b[1], b[0]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const ddx = qx - px;
    const ddy = qy - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestI = i;
      bestT = t;
    }
  }
  const a = coords[bestI];
  const b = coords[bestI + 1];
  const segLen = cumDistM[bestI + 1] - cumDistM[bestI];
  return {
    i: bestI,
    t: bestT,
    distM: cumDistM[bestI] + bestT * segLen,
    lat: a[1] + bestT * (b[1] - a[1]),
    lon: a[0] + bestT * (b[0] - a[0]),
  };
}

export function pointAtDistance(
  coords: readonly (readonly [number, number])[],
  cumDistM: readonly number[],
  targetM: number,
): { lat: number; lon: number } | null {
  const n = coords.length;
  if (n === 0 || cumDistM.length !== n) return null;
  if (targetM <= 0) return { lat: coords[0][1], lon: coords[0][0] };
  if (targetM >= cumDistM[n - 1]) return { lat: coords[n - 1][1], lon: coords[n - 1][0] };
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumDistM[mid] < targetM) lo = mid + 1;
    else hi = mid;
  }
  const i = lo - 1;
  const a = coords[i];
  const b = coords[i + 1];
  const span = cumDistM[i + 1] - cumDistM[i];
  const f = span === 0 ? 0 : (targetM - cumDistM[i]) / span;
  return { lat: a[1] + f * (b[1] - a[1]), lon: a[0] + f * (b[0] - a[0]) };
}

export function cumulativeDistances(
  coords: readonly (readonly [number, number])[],
  e: Equirect,
): number[] {
  const out = new Array<number>(coords.length);
  out[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const [ax, ay] = toXY(e, a[1], a[0]);
    const [bx, by] = toXY(e, b[1], b[0]);
    const dx = bx - ax;
    const dy = by - ay;
    out[i] = out[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  return out;
}
