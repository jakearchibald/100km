import { signal } from '@preact/signals';
import type { HistoricData } from '../data/historic.ts';
import type { UrlSnapshot } from '../share/share.ts';

export interface GpsFix {
  lat: number;
  lon: number;
  accuracy: number;
  tsMs: number;
}

export const urlSnapshot = signal<UrlSnapshot | null>(null);
export const gpsPosition = signal<GpsFix | null>(null);
export const nowMs = signal<number>(Date.now());
export const isVisible = signal<boolean>(true);
export const historic = signal<HistoricData | null>(null);

export const positionFromUrl = signal<boolean>(false);
export const timeFromUrl = signal<boolean>(false);

/** Debug-only override of START_2026_MS via `?start=ISO8601`. null = use the configured constant. */
export const startOverrideMs = signal<number | null>(null);
