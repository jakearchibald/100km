import type { HistoricPoint } from '../types.ts';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lookupByTOffset(points: readonly HistoricPoint[], tSec: number): HistoricPoint | null {
  const n = points.length;
  if (n === 0) return null;
  if (tSec < points[0].t || tSec > points[n - 1].t) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (points[mid].t <= tSec) lo = mid;
    else hi = mid - 1;
  }
  if (lo === n - 1) return points[lo];
  const a = points[lo];
  const b = points[lo + 1];
  const span = b.t - a.t;
  const f = span === 0 ? 0 : (tSec - a.t) / span;
  return {
    t: tSec,
    d: lerp(a.d, b.d, f),
    lat: lerp(a.lat, b.lat, f),
    lon: lerp(a.lon, b.lon, f),
  };
}

export function tAtDistance(points: readonly HistoricPoint[], distM: number): number | null {
  const n = points.length;
  if (n === 0) return null;
  if (distM < points[0].d) return points[0].t;
  if (distM > points[n - 1].d) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].d < distM) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return points[0].t;
  const a = points[lo - 1];
  const b = points[lo];
  const span = b.d - a.d;
  const f = span === 0 ? 0 : (distM - a.d) / span;
  return lerp(a.t, b.t, f);
}
