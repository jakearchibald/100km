import { computed, type ReadonlySignal } from '@preact/signals';
import route from '../data/route-2026.ts';
import { makeEquirect } from '../geo/distance.ts';
import { projectOntoPolyline, type Projection } from '../geo/projection.ts';
import { lookupByTOffset, tAtDistance } from '../geo/search.ts';
import type { HistoricPoint } from '../types.ts';
import { START_2026_MS } from '../../data-config/start-2026.ts';
import {
  gpsPosition,
  historic,
  nowMs,
  positionFromUrl,
  startOverrideMs,
  timeFromUrl,
  urlSnapshot,
} from './signals.ts';

export { route };

const eq = makeEquirect(route.midLat, route.midLon);
const routeCoords = route.geojson.features[0].geometry.type === 'LineString'
  ? (route.geojson.features[0].geometry.coordinates as [number, number][])
  : [];

export const currentPosition: ReadonlySignal<{ lat: number; lon: number } | null> = computed(() => {
  if (positionFromUrl.value) {
    const s = urlSnapshot.value;
    if (s && s.lat !== null && s.lon !== null) return { lat: s.lat, lon: s.lon };
    return null;
  }
  const g = gpsPosition.value;
  return g ? { lat: g.lat, lon: g.lon } : null;
});

export const currentTimeMs: ReadonlySignal<number> = computed(() => {
  if (timeFromUrl.value) {
    const t = urlSnapshot.value?.tMs;
    if (t !== null && t !== undefined) return t;
  }
  return nowMs.value;
});

export const elapsedFrom2026Sec: ReadonlySignal<number> = computed(() => {
  const start = startOverrideMs.value ?? START_2026_MS;
  return (currentTimeMs.value - start) / 1000;
});

export const routeProjection: ReadonlySignal<Projection | null> = computed(() => {
  const p = currentPosition.value;
  if (!p) return null;
  return projectOntoPolyline(p.lat, p.lon, routeCoords, route.cumDistM, eq);
});

export const progress2026: ReadonlySignal<number | null> = computed(() => {
  if (elapsedFrom2026Sec.value < 0) return 0;
  const proj = routeProjection.value;
  if (!proj) return null;
  const pct = proj.distM / route.totalDistanceM;
  return pct < 0 ? 0 : pct > 1 ? 1 : pct;
});

function historicAt(year: 'y21' | 'y22'): HistoricPoint | null {
  const h = historic.value;
  if (!h) return null;
  const points = h[year].points;
  if (points.length === 0) return null;
  const tSec = elapsedFrom2026Sec.value;
  const first = points[0].t;
  const last = points[points.length - 1].t;
  const clamped = tSec < first ? first : tSec > last ? last : tSec;
  return lookupByTOffset(points, clamped);
}

export const historic2021AtElapsed: ReadonlySignal<HistoricPoint | null> = computed(() =>
  historicAt('y21'),
);
export const historic2022AtElapsed: ReadonlySignal<HistoricPoint | null> = computed(() =>
  historicAt('y22'),
);

function progressFor(year: 'y21' | 'y22', point: HistoricPoint | null): number | null {
  if (elapsedFrom2026Sec.value < 0) return 0;
  const h = historic.value;
  if (!h || !point) return null;
  const total = h[year].totalDistanceM;
  if (total <= 0) return null;
  return point.d / total;
}

export const progress2021 = computed(() => progressFor('y21', historic2021AtElapsed.value));
export const progress2022 = computed(() => progressFor('y22', historic2022AtElapsed.value));

function deltaFor(year: 'y21' | 'y22'): number | null {
  if (elapsedFrom2026Sec.value < 0) return null;
  const h = historic.value;
  const proj = routeProjection.value;
  if (!h || !proj) return null;
  // The historic year's TCX distance is longer than the 2026 route because of GPS noise.
  // Scale the user's route distance into the historic year's distance space so the lookup
  // compares like with like (proportionally far through, not metres-on-different-rulers).
  const scale = h[year].totalDistanceM / route.totalDistanceM;
  const t = tAtDistance(h[year].points, proj.distM * scale);
  if (t === null) return null;
  return t - elapsedFrom2026Sec.value;
}

export const delta2021Sec = computed(() => deltaFor('y21'));
export const delta2022Sec = computed(() => deltaFor('y22'));
