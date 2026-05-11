import { signal } from '@preact/signals';

const STORAGE_KEY = '100km.viewport';

export interface FlyRequest {
  lat: number;
  lon: number;
  zoom?: number;
}

/**
 * Bumped each time something requests the map fly to a location.
 * The Map component watches it via `effect()` and reacts; the actual target
 * lives in `flyTarget` to avoid losing changes if two requests collide.
 */
export const flyRequestId = signal<number>(0);
export const flyTarget = signal<FlyRequest | null>(null);

export function requestFlyTo(target: FlyRequest): void {
  flyTarget.value = target;
  flyRequestId.value = flyRequestId.value + 1;
}

export interface Viewport {
  lat: number;
  lon: number;
  zoom: number;
}

export function readViewport(): Viewport | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Viewport>;
    const lat = parsed.lat;
    const lon = parsed.lon;
    const zoom = parsed.zoom;
    if (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      typeof zoom === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Number.isFinite(zoom)
    ) {
      return { lat, lon, zoom };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function writeViewport(v: Viewport): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota / disabled — ignore */
  }
}
