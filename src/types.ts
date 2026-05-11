import type { FeatureCollection, LineString, Point } from 'geojson';

export interface HistoricPoint {
  t: number;
  d: number;
  lat: number;
  lon: number;
}

export interface YearTrack {
  year: number;
  startMs: number;
  totalDistanceM: number;
  points: HistoricPoint[];
}

export interface RouteWaypoint {
  name: string;
  lat: number;
  lon: number;
  cumDistM: number;
}

export interface RouteFeatureProps {
  kind: 'route' | 'waypoint';
  name?: string;
}

export type RouteGeoJson = FeatureCollection<LineString | Point, RouteFeatureProps>;

export interface RouteData {
  geojson: RouteGeoJson;
  totalDistanceM: number;
  cumDistM: number[];
  midLat: number;
  midLon: number;
  waypoints: RouteWaypoint[];
}
