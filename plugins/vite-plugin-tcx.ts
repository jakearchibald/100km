import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { XMLParser } from 'fast-xml-parser';
import type { HistoricPoint, YearTrack } from '../src/types.ts';
import { makeEquirect, toXY } from '../src/geo/distance.ts';

const RESAMPLE_SEC = 10;

interface FinishClamp {
  lat: number;
  lon: number;
  radiusM: number;
}

// Per-year hand-coded finish clamps. Some recordings were left running past the
// real finish; stop emitting points once we get within radiusM of the target.
const FINISH_CLAMPS: Record<number, FinishClamp> = {
  2021: { lat: 50.829655377010624, lon: -0.11198652838670355, radiusM: 15 },
};

interface RawTrackpoint {
  Time?: string;
  Position?: {
    LatitudeDegrees?: string;
    LongitudeDegrees?: string;
  };
  DistanceMeters?: string;
}

interface RawTcx {
  TrainingCenterDatabase: {
    Activities: {
      Activity: {
        Id?: string;
        Lap:
          | { Track: { Trackpoint: RawTrackpoint[] } }
          | { Track: { Trackpoint: RawTrackpoint[] } }[];
      };
    };
  };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function buildYearTrack(parsed: RawTcx, year: number): YearTrack {
  const activity = parsed.TrainingCenterDatabase.Activities.Activity;
  const laps = asArray(activity.Lap);
  const trackpoints: RawTrackpoint[] = [];
  for (const lap of laps) trackpoints.push(...asArray(lap.Track.Trackpoint));

  const clamp = FINISH_CLAMPS[year];
  const clampEq = clamp ? makeEquirect(clamp.lat, clamp.lon) : null;
  const clampR2 = clamp ? clamp.radiusM * clamp.radiusM : 0;

  const points: HistoricPoint[] = [];
  let lastDist = 0;
  let lastEmittedSec = -Infinity;
  let startMs: number | null = null;
  let maxDist = 0;
  let lastPoint: HistoricPoint | null = null;
  let clampHit = false;

  for (const tp of trackpoints) {
    if (!tp.Time) continue;
    const tMs = Date.parse(tp.Time);
    if (!Number.isFinite(tMs)) continue;
    if (startMs === null) startMs = tMs;

    if (tp.DistanceMeters !== undefined) {
      const d = parseFloat(tp.DistanceMeters);
      if (Number.isFinite(d)) {
        lastDist = d;
        if (d > maxDist) maxDist = d;
      }
    }

    if (!tp.Position?.LatitudeDegrees || !tp.Position.LongitudeDegrees)
      continue;
    const lat = parseFloat(tp.Position.LatitudeDegrees);
    const lon = parseFloat(tp.Position.LongitudeDegrees);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const tSec = Math.round((tMs - startMs!) / 1000);
    const point: HistoricPoint = { t: tSec, d: lastDist, lat, lon };
    lastPoint = point;
    if (tSec - lastEmittedSec >= RESAMPLE_SEC) {
      points.push(point);
      lastEmittedSec = tSec;
    }

    if (clamp && clampEq) {
      const [dx, dy] = toXY(clampEq, lat, lon);
      if (dx * dx + dy * dy <= clampR2) {
        if (points.length === 0 || points[points.length - 1].t !== point.t) {
          points.push(point);
        }
        maxDist = lastDist;
        clampHit = true;
        break;
      }
    }
  }

  if (
    !clampHit &&
    lastPoint &&
    (points.length === 0 || points[points.length - 1].t !== lastPoint.t)
  ) {
    points.push(lastPoint);
  }

  // Anchor the first emitted point at t=0, d=0 so "elapsed time from start"
  // doesn't include the GPS-acquisition delay between the activity's official
  // start (Activity.Id) and the first usable trackpoint.
  if (points.length > 0) {
    points[0] = { ...points[0], t: 0, d: 0 };
  }

  return {
    year,
    startMs: startMs ?? 0,
    totalDistanceM: maxDist,
    points,
  };
}

function yearFromId(id: string): number {
  const match = id.match(/(\d{4})\.tcx$/);
  if (!match) throw new Error(`Cannot infer year from TCX path: ${id}`);
  return parseInt(match[1], 10);
}

export default function viteTcxPlugin(): Plugin {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
  });
  return {
    name: 'vite-plugin-tcx',
    async load(id) {
      const path = id.split('?')[0];
      if (!path.endsWith('.tcx')) return null;
      const xml = await readFile(path, 'utf8');
      const parsed = parser.parse(xml) as RawTcx;
      const track = buildYearTrack(parsed, yearFromId(path));
      return {
        code: `export default ${JSON.stringify(track)};`,
        map: null,
      };
    },
  };
}
