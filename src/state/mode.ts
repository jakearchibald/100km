import { readUrlSnapshot } from '../share/share.ts';
import {
  nowMs,
  positionFromUrl,
  startOverrideMs,
  timeFromUrl,
  timeMult,
  urlSnapshot,
} from './signals.ts';

const snapshot = readUrlSnapshot();
if (snapshot) {
  urlSnapshot.value = snapshot;
  positionFromUrl.value = snapshot.lat !== null && snapshot.lon !== null;
  timeFromUrl.value = snapshot.tMs !== null;
  if (snapshot.tMs !== null) nowMs.value = snapshot.tMs;
}

const params = new URLSearchParams(location.search);
const startParam = params.get('start');
if (startParam) {
  const ms = Date.parse(startParam);
  if (Number.isFinite(ms)) {
    startOverrideMs.value = ms;
  } else {
    console.warn(`[mode] ignoring invalid ?start=${startParam}`);
  }
}

const timeMultParam = params.get('timeMult');
if (timeMultParam) {
  const n = parseFloat(timeMultParam);
  if (Number.isFinite(n) && n > 0) {
    timeMult.value = n;
  } else {
    console.warn(`[mode] ignoring invalid ?timeMult=${timeMultParam}`);
  }
}
