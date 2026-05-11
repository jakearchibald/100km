import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { XMLParser } from 'fast-xml-parser';
import type { HistoricPoint, YearTrack } from '../src/types.ts';

const RESAMPLE_SEC = 10;

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

  const points: HistoricPoint[] = [];
  let lastDist = 0;
  let lastEmittedSec = -Infinity;
  let startMs: number | null = null;
  let maxDist = 0;
  let lastPoint: HistoricPoint | null = null;

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

    if (!tp.Position?.LatitudeDegrees || !tp.Position.LongitudeDegrees) continue;
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
  }

  if (lastPoint && (points.length === 0 || points[points.length - 1].t !== lastPoint.t)) {
    points.push(lastPoint);
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
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
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
