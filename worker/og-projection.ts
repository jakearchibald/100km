import route from '../src/data/route-2026.ts';
import historic from '../src/data/historic-chunk.ts';
import { makeEquirect } from '../src/geo/distance.ts';
import { projectOntoPolyline } from '../src/geo/projection.ts';
import { tAtDistance } from '../src/geo/search.ts';
import { START_2026_MS } from '../data-config/start-2026.ts';
import { cumPx, totalPx } from 'virtual:og-basemap';

const eq = makeEquirect(route.midLat, route.midLon);
const routeCoords =
  route.geojson.features[0].geometry.type === 'LineString'
    ? (route.geojson.features[0].geometry.coordinates as [number, number][])
    : [];

export interface OgProjection {
  pctComplete: number;
  elapsedSec: number;
  doneLengthPx: number;
  delta2022Sec: number | null;
}

function pixelsAlongRoute(i: number, distM: number): number {
  const dStart = route.cumDistM[i];
  const dEnd = route.cumDistM[i + 1];
  const pxStart = cumPx[i];
  const pxEnd = cumPx[i + 1];
  if (pxEnd === undefined || dEnd === undefined) return pxStart;
  const segM = dEnd - dStart;
  if (segM <= 0) return pxStart;
  const f = (distM - dStart) / segM;
  return pxStart + f * (pxEnd - pxStart);
}

export function computeProjection(
  lat: number,
  lon: number,
  tMs: number,
): OgProjection {
  const proj = projectOntoPolyline(lat, lon, routeCoords, route.cumDistM, eq);
  const elapsedSec = (tMs - START_2026_MS) / 1000;

  const pctRaw = proj.distM / route.totalDistanceM;
  const pctComplete =
    elapsedSec < 0 ? 0 : pctRaw < 0 ? 0 : pctRaw > 1 ? 1 : pctRaw;

  const doneLengthPx =
    elapsedSec < 0
      ? 0
      : Math.max(0, Math.min(totalPx, pixelsAlongRoute(proj.i, proj.distM)));

  let delta2022Sec: number | null = null;
  if (elapsedSec >= 0) {
    const scale = historic.y22.totalDistanceM / route.totalDistanceM;
    const t = tAtDistance(historic.y22.points, proj.distM * scale);
    if (t !== null) delta2022Sec = t - elapsedSec;
  }

  return {
    pctComplete,
    elapsedSec,
    doneLengthPx,
    delta2022Sec,
  };
}
