import route from '../src/data/route-2026.ts';
import historic from '../src/data/historic-chunk.ts';
import { makeEquirect } from '../src/geo/distance.ts';
import { projectOntoPolyline, type Projection } from '../src/geo/projection.ts';
import { tAtDistance } from '../src/geo/search.ts';
import { START_2026_MS } from '../data-config/start-2026.ts';

const eq = makeEquirect(route.midLat, route.midLon);
const routeCoords =
  route.geojson.features[0].geometry.type === 'LineString'
    ? (route.geojson.features[0].geometry.coordinates as [number, number][])
    : [];

export interface OgProjection {
  userLat: number;
  userLon: number;
  proj: Projection;
  pctComplete: number;
  elapsedSec: number;
  doneCoords: [number, number][];
  delta2022Sec: number | null;
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

  const doneCoords: [number, number][] = [];
  for (let i = 0; i <= proj.i; i++) doneCoords.push(routeCoords[i]);
  doneCoords.push([proj.lon, proj.lat]);

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
    delta2022Sec,
  };
}

export { routeCoords };
