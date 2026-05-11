import { gpsPosition, isVisible, positionFromUrl } from './signals.ts';

let watchId: number | null = null;
let pending: GeolocationPosition | null = null;
let rafId: number | null = null;

function flush() {
  rafId = null;
  const p = pending;
  pending = null;
  if (!p) return;
  gpsPosition.value = {
    lat: p.coords.latitude,
    lon: p.coords.longitude,
    accuracy: p.coords.accuracy,
    tsMs: p.timestamp,
  };
}

function onFix(pos: GeolocationPosition) {
  pending = pos;
  rafId ??= requestAnimationFrame(flush);
}

function onErr(err: GeolocationPositionError) {
  console.warn('[geolocation] error', err.code, err.message);
}

export function startWatch() {
  if (positionFromUrl.value) return;
  if (!isVisible.value) return;
  if (watchId !== null) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(onFix, onErr, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 30000,
  });
}

export function stopWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  pending = null;
}
