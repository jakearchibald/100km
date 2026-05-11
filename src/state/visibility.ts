import {
  isVisible,
  nowMs,
  positionFromUrl,
  timeFromUrl,
  timeMult,
} from './signals.ts';
import { startWatch, stopWatch } from './geolocation.ts';

let intervalId: number | null = null;
let baseRealMs = 0;
let baseSimMs = 0;

function anchor() {
  baseRealMs = Date.now();
  baseSimMs = nowMs.value;
}

function tick() {
  const mult = timeMult.value;
  if (mult === 1) {
    nowMs.value = Date.now();
    return;
  }
  nowMs.value = baseSimMs + (Date.now() - baseRealMs) * mult;
}

function startTicker() {
  if (timeFromUrl.value) return;
  if (intervalId !== null) return;
  anchor();
  intervalId = window.setInterval(tick, 1000);
}

function stopTicker() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function initLifecycle() {
  isVisible.value = document.visibilityState === 'visible';

  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    isVisible.value = visible;
    if (visible) {
      if (!timeFromUrl.value) nowMs.value = Date.now();
      startTicker();
      if (!positionFromUrl.value) startWatch();
    } else {
      stopTicker();
      stopWatch();
    }
  });

  if (isVisible.value) {
    if (!timeFromUrl.value) nowMs.value = Date.now();
    startTicker();
    if (!positionFromUrl.value) startWatch();
  }
}
