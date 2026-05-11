import { readUrlSnapshot } from '../share/share.ts';
import { nowMs, positionFromUrl, timeFromUrl, urlSnapshot } from './signals.ts';

const snapshot = readUrlSnapshot();
if (snapshot) {
  urlSnapshot.value = snapshot;
  positionFromUrl.value = snapshot.lat !== null && snapshot.lon !== null;
  timeFromUrl.value = snapshot.tMs !== null;
  if (snapshot.tMs !== null) nowMs.value = snapshot.tMs;
}
