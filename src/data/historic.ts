import type { YearTrack } from '../types.ts';

export interface HistoricData {
  y21: YearTrack;
  y22: YearTrack;
}

export function loadHistoric(): Promise<HistoricData> {
  return import('./historic-chunk.ts').then((m) => m.default);
}
