import route from '../src/data/route-2026.ts';
import historic from '../src/data/historic-chunk.ts';
import { makeEquirect } from '../src/geo/distance.ts';
import { projectOntoPolyline, type Projection } from '../src/geo/projection.ts';
import { lookupByTOffset, tAtDistance } from '../src/geo/search.ts';
import { START_2026_MS } from '../data-config/start-2026.ts';
import type { HistoricPoint } from '../src/types.ts';

const eq = makeEquirect(route.midLat, route.midLon);
const routeCoords = route.geojson.features[0].geometry.type === 'LineString'
  ? (route.geojson.features[0].geometry.coordinates as [number, number][])
  : [];

export interface OgProjection {
  userLat: number;
  userLon: number;
  proj: Projection;
  pctComplete: number;
  elapsedSec: number;
  doneCoords: [number, number][];
  historic2022: { lat: number; lon: number } | null;
  delta2022Sec: number | null;
}

function clampHistoric(points: readonly HistoricPoint[], tSec: number): HistoricPoint | null {
  if (points.length === 0) return null;
  const first = points[0].t;
  const last = points[points.length - 1].t;
  const clamped = tSec < first ? first : tSec > last ? last : tSec;
  return lookupByTOffset(points, clamped);
}

export function computeProjection(lat: number, lon: number, tMs: number): OgProjection {
  const proj = projectOntoPolyline(lat, lon, routeCoords, route.cumDistM, eq);
  const elapsedSec = (tMs - START_2026_MS) / 1000;

  const pctRaw = proj.distM / route.totalDistanceM;
  const pctComplete =
    elapsedSec < 0 ? 0 : pctRaw < 0 ? 0 : pctRaw > 1 ? 1 : pctRaw;

  const doneCoords: [number, number][] = [];
  for (let i = 0; i <= proj.i; i++) doneCoords.push(routeCoords[i]);
  doneCoords.push([proj.lon, proj.lat]);

  const h22 = clampHistoric(historic.y22.points, elapsedSec);
  const historic2022 = h22 ? { lat: h22.lat, lon: h22.lon } : null;

  let delta2022Sec: number | null = null;
  if (elapsedSec >= 0) {
    const scale = historic.y22.totalDistanceM / route.totalDistanceM;
    const t = tAtDistance(historic.y22.points, proj.distM * scale);
    if (t !== null) delta2022Sec = t - elapsedSec;
  }

  return {
    userLat: lat,
    userLon: lon,
    proj,
    pctComplete,
    elapsedSec,
    doneCoords,
    historic2022,
    delta2022Sec,
  };
}

export { routeCoords };
