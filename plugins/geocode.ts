import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

export interface GeocodeResult {
  lat: number;
  lon: number;
}

interface CacheFile {
  [address: string]: GeocodeResult;
}

async function readCache(path: string): Promise<CacheFile> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as CacheFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

async function writeCache(path: string, cache: CacheFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted: CacheFile = {};
  for (const key of Object.keys(cache).sort()) sorted[key] = cache[key];
  await writeFile(path, JSON.stringify(sorted, null, 2) + '\n');
}

export interface GeocoderOptions {
  cachePath: string;
  maptilerKey: string | undefined;
  proximity?: { lat: number; lon: number };
}

export class Geocoder {
  readonly #opts: GeocoderOptions;
  #cache: CacheFile = {};
  #loaded = false;

  constructor(opts: GeocoderOptions) {
    this.#opts = opts;
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!this.#loaded) {
      this.#cache = await readCache(this.#opts.cachePath);
      this.#loaded = true;
    }
    const key = address.replace(/\s+/g, ' ').trim();
    if (this.#cache[key]) return this.#cache[key];
    if (!this.#opts.maptilerKey) {
      throw new Error(
        `Geocoding required for "${address}" but VITE_MAPTILER_KEY is not set; add it to .env.local`,
      );
    }
    const params = new URLSearchParams({
      key: this.#opts.maptilerKey,
      country: 'gb',
      limit: '1',
    });
    if (this.#opts.proximity) {
      params.set('proximity', `${this.#opts.proximity.lon},${this.#opts.proximity.lat}`);
    }
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(key)}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Geocode failed for "${address}": ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { features?: { center?: [number, number] }[] };
    const center = json.features?.[0]?.center;
    if (!center) return null;
    const result: GeocodeResult = { lon: center[0], lat: center[1] };
    this.#cache[key] = result;
    await writeCache(this.#opts.cachePath, this.#cache);
    return result;
  }
}
