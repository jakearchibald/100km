export interface UrlSnapshot {
  lat: number | null;
  lon: number | null;
  tMs: number | null;
}

export function readUrlSnapshot(search: string = location.search): UrlSnapshot | null {
  const p = new URLSearchParams(search);
  const latStr = p.get('lat');
  const lonStr = p.get('lon');
  const tStr = p.get('t');
  const lat = latStr === null ? null : parseFloat(latStr);
  const lon = lonStr === null ? null : parseFloat(lonStr);
  const tMs = tStr === null ? null : Date.parse(tStr);
  const hasPos =
    lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon);
  const hasT = tMs !== null && Number.isFinite(tMs);
  if (!hasPos && !hasT) return null;
  return {
    lat: hasPos ? lat : null,
    lon: hasPos ? lon : null,
    tMs: hasT ? tMs : null,
  };
}

export function buildShareUrl(pos: { lat: number; lon: number } | null, tMs: number): string {
  const u = new URL(location.href);
  u.search = '';
  if (pos) {
    u.searchParams.set('lat', pos.lat.toFixed(6));
    u.searchParams.set('lon', pos.lon.toFixed(6));
  }
  u.searchParams.set('t', new Date(tMs).toISOString());
  return u.toString();
}

export type ShareResult = 'shared' | 'cancelled' | 'copied';

export async function share(url: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: '100km progress', url });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
