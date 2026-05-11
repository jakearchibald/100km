import { isVisible, nowMs, positionFromUrl, timeFromUrl } from './signals.ts';
import { startWatch, stopWatch } from './geolocation.ts';

let intervalId: number | null = null;

function startTicker() {
  if (timeFromUrl.value) return;
  if (intervalId !== null) return;
  intervalId = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
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
