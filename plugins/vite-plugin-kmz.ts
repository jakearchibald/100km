import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { XMLParser } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';
import type { RouteData, RouteWaypoint, RouteGeoJson } from '../src/types.ts';
import { makeEquirect } from '../src/geo/distance.ts';
import { cumulativeDistances, projectOntoPolyline } from '../src/geo/projection.ts';
import { Geocoder } from './geocode.ts';

const MAIN_ROUTE_NAME = 'L2B 100km Route 2026_131125';
const STOPS_FOLDER_NAME = 'The Route & Rest stops';
const ROUTES_FOLDER_NAME = 'L2B Routes';
const SKIP_NAME_PREFIX = '25km Loop';

interface RawCoord {
  coordinates?: string;
}

interface RawPlacemark {
  name?: string;
  description?: string;
  address?: string;
  Point?: RawCoord;
  LineString?: RawCoord;
}

interface RawFolder {
  name?: string;
  Placemark?: RawPlacemark | RawPlacemark[];
}

interface RawKml {
  kml: {
    Document: {
      Folder?: RawFolder | RawFolder[];
    };
  };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function parseCoordString(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const parts = raw.split(',');
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    out.push([lon, lat]);
  }
  return out;
}

function parseSinglePoint(text: string): [number, number] | null {
  const parts = text.trim().split(',');
  if (parts.length < 2) return null;
  const lon = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function bboxCenter(coords: readonly (readonly [number, number])[]): [number, number] {
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
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

async function buildRouteData(parsed: RawKml, geocoder: Geocoder): Promise<RouteData> {
  const folders = asArray(parsed.kml.Document.Folder);
  const routesFolder = folders.find((f) => f.name === ROUTES_FOLDER_NAME);
  const stopsFolder = folders.find((f) => f.name === STOPS_FOLDER_NAME);
  if (!routesFolder) throw new Error(`KML missing folder: ${ROUTES_FOLDER_NAME}`);

  const routePlacemark = asArray(routesFolder.Placemark).find(
    (p) => p.name === MAIN_ROUTE_NAME,
  );
  if (!routePlacemark?.LineString?.coordinates) {
    throw new Error(`KML missing route LineString: ${MAIN_ROUTE_NAME}`);
  }
  const coords = parseCoordString(routePlacemark.LineString.coordinates);
  if (coords.length < 2) throw new Error('Route LineString has no usable coordinates');

  const [midLat, midLon] = bboxCenter(coords);
  const eq = makeEquirect(midLat, midLon);
  const cumDistM = cumulativeDistances(coords, eq);
  const totalDistanceM = cumDistM[cumDistM.length - 1];

  const waypoints: RouteWaypoint[] = [];
  if (stopsFolder) {
    for (const pm of asArray(stopsFolder.Placemark)) {
      if (!pm.name) continue;
      if (pm.name.startsWith(SKIP_NAME_PREFIX)) continue;
      let pt: [number, number] | null = null;
      if (pm.Point?.coordinates) {
        pt = parseSinglePoint(pm.Point.coordinates);
      }
      if (!pt && pm.address) {
        const postcode = pm.address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
        const query = postcode ? postcode[0].toUpperCase() : pm.address;
        const geocoded = await geocoder.geocode(query);
        if (geocoded) pt = [geocoded.lon, geocoded.lat];
      }
      if (!pt) continue;
      const proj = projectOntoPolyline(pt[1], pt[0], coords, cumDistM, eq);
      waypoints.push({ name: pm.name, lat: proj.lat, lon: proj.lon, cumDistM: proj.distM });
    }
  }
  waypoints.sort((a, b) => a.cumDistM - b.cumDistM);

  const geojson: RouteGeoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { kind: 'route' },
      },
      ...waypoints.map((w) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
        properties: { kind: 'waypoint' as const, name: w.name },
      })),
    ],
  };

  return { geojson, totalDistanceM, cumDistM, midLat, midLon, waypoints };
}

export default function viteKmzPlugin(): Plugin {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
  let geocoder: Geocoder | null = null;
  return {
    name: 'vite-plugin-kmz',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'VITE_');
      const key = env.VITE_MAPTILER_KEY;
      const cachePath = resolve(config.root, 'data-config/waypoint-cache.json');
      geocoder = new Geocoder({
        cachePath,
        maptilerKey: key,
        proximity: { lat: 51.15, lon: -0.2 },
      });
    },
    async load(id) {
      const path = id.split('?')[0];
      if (!path.endsWith('.kmz')) return null;
      if (!geocoder) throw new Error('KMZ plugin not configured');
      const buf = await readFile(path);
      const files = unzipSync(new Uint8Array(buf));
      const docKml = files['doc.kml'];
      if (!docKml) throw new Error(`KMZ missing doc.kml: ${path}`);
      const kmlText = strFromU8(docKml);
      const parsed = parser.parse(kmlText) as RawKml;
      const route = await buildRouteData(parsed, geocoder);
      return {
        code: `export default ${JSON.stringify(route)};`,
        map: null,
      };
    },
  };
}
