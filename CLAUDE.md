# 100km — repo guide

Live progress tracker for the London → Brighton 100km Challenge on 23 May 2026. Static site (assets only — no Cloudflare Worker) that compares the user's live GPS to two historic TCX traces (2021, 2022) and the 2026 KMZ route.

The project plan lives in [plan.md](plan.md). The implementation plan is at `~/.claude/plans/read-plan-md-declarative-pony.md`.

## Stack

Preact 10 + `@preact/signals` + Vite 8 + Cloudflare Vite plugin + Wrangler 4. TypeScript with `verbatimModuleSyntax` and `erasableSyntaxOnly`. **CSS Modules** per component (no global stylesheet beyond [src/reset.css](src/reset.css)). MapLibre GL JS for mapping. `pnpm` for package management.

## Scripts

```sh
pnpm dev        # vite dev server, http://127.0.0.1:5173/
pnpm build      # tsc -b && vite build  →  dist/
pnpm preview    # production build + serve
pnpm deploy     # build + wrangler deploy
```

There is no separate "data build" step — TCX/KMZ files are transformed at import time by Vite plugins.

## Environment

`VITE_MAPTILER_KEY` is required at **both** build time (waypoint geocoding) and runtime (tile style URL). In dev, put it in [.env.local](.env.local) — gitignored. In production, set it as an env var in the Cloudflare project. The key is **not a secret**: provider-side referrer restrictions protect quota.

## File layout

- [data/](data/) — raw source files. `2021.tcx`, `2022.tcx`, `2026.kmz`. Don't edit by hand. The KMZ replaces wholesale if the route changes.
- [data-config/](data-config/) — hand-editable constants and committed caches.
  - [start-2026.ts](data-config/start-2026.ts) — the official 07:00 BST set-off time. **Edit here if the start slips on the day**, no other code changes needed.
  - [waypoint-cache.json](data-config/waypoint-cache.json) — committed geocode results keyed by query string. Hand-fix entries if the geocoder picked the wrong location; the file is the source of truth and bypasses the network call on subsequent builds.
- [plugins/](plugins/) — Vite plugins that transform raw data at import time.
  - [vite-plugin-tcx.ts](plugins/vite-plugin-tcx.ts) — parses TCX, resamples to ~10s, emits `YearTrack`.
  - [vite-plugin-kmz.ts](plugins/vite-plugin-kmz.ts) — unzips KMZ, parses KML, projects waypoints onto the route, emits `RouteData`.
  - [geocode.ts](plugins/geocode.ts) — `Geocoder` class wrapping MapTiler geocoding + the JSON cache.
- [src/](src/) — the app.
  - [types.ts](src/types.ts) — `HistoricPoint`, `YearTrack`, `RouteData`, `RouteWaypoint`.
  - [client.d.ts](src/client.d.ts) — module declarations for `*.tcx`/`*.kmz` imports and `import.meta.env.VITE_MAPTILER_KEY`.
  - [constants.ts](src/constants.ts) — `COLORS`, `TILE_STYLE`.
  - [data/](src/data/) — wrappers around the data plugins. `route-2026.ts` (static import → inlined in main bundle), `historic.ts` (`loadHistoric()` dynamic import), `historic-chunk.ts` (combined 21+22 chunk).
  - [state/](src/state/) — signal-based state.
    - [signals.ts](src/state/signals.ts) — source signals. `urlSnapshot`, `gpsPosition`, `nowMs`, `isVisible`, `historic`, `positionFromUrl`, `timeFromUrl`.
    - [mode.ts](src/state/mode.ts) — reads URL params **once at module load**, sets `positionFromUrl`/`timeFromUrl` and seeds `urlSnapshot`/`nowMs`. Import side-effect from `App.tsx`.
    - [projection.ts](src/state/projection.ts) — derived signals (`currentPosition`, `currentTimeMs`, `routeProjection`, `progress*`, `delta*`, `historic*AtElapsed`). Re-exports `route` for convenience.
    - [geolocation.ts](src/state/geolocation.ts) — `watchPosition` lifecycle; coalesces fixes through one `requestAnimationFrame`.
    - [visibility.ts](src/state/visibility.ts) — pauses ticker + GPS watch when the tab is hidden; resumes on visibility. **Call `initLifecycle()` once from `App.tsx`'s `useEffect`** — not at module load (it needs `mode.ts` to have run first).
  - [geo/](src/geo/) — pure functions.
    - [distance.ts](src/geo/distance.ts) — equirectangular helpers, computed once at the route midpoint.
    - [projection.ts](src/geo/projection.ts) — `projectOntoPolyline`, `pointAtDistance`, `cumulativeDistances`. **Shared between build (`plugins/vite-plugin-kmz.ts`) and runtime (`state/projection.ts`)**.
    - [search.ts](src/geo/search.ts) — `lookupByTOffset`, `tAtDistance`. Binary search on the historic points arrays.
  - [share/share.ts](src/share/share.ts) — URL param parse/build + `navigator.share` / clipboard fallback.
  - [components/](src/components/) — one folder per component, each with a `.tsx` and a `.module.css`.

## URL parameters

- `?lat=&lon=` — freeze the user position. No geolocation prompt or watch.
- `?t=ISO8601` — freeze "current time" for the historic comparison. No 1s ticker.
- Any combination works. `t` alone freezes time but still uses live GPS.
- `mode.ts` reads these once at module load. They cannot change after boot.

## Signal conventions

- All state goes through `@preact/signals`. **Never use `useState`.**
- In JSX, pass **signal objects** as text/attribute values (`<span>{progressPct}</span>`, `<div style={fillStyle} />`) so Preact patches the DOM node without re-rendering the component. Don't write `{progressPct.value}` in JSX — that subscribes the whole component.
- For style strings that depend on signals, build a `computed(() => "...")` returning a CSS string and pass that. Preact's `style` object handling **does not** unwrap signals as property values.
- Use `.value` inside `computed`, `effect`, and event handlers — these are not JSX contexts.

## Class private fields

The codebase uses **real `#private` fields**, not the TypeScript `private` keyword. Don't reintroduce TS-private (and TS parameter properties also break under `erasableSyntaxOnly`).

## Data import plugins

`import x from '../../data/2021.tcx'` returns a fully-formed `YearTrack` object — no XML parsing in the browser. The plugin runs in Node during Vite's `load` hook; its output gets bundled like any other ES module.

- Static `import` → data ends up inlined in the importing chunk. The 2026 route uses this.
- Dynamic `import()` → data ends up in a separate chunk. The historic years use this via `loadHistoric()` in [src/data/historic.ts](src/data/historic.ts), wrapping a `historic-chunk.ts` that statically imports both years (so they share one chunk and gzip together).

## Waypoint geocoding

KML stops only have a `<Point>` for START and the loop point. Everything else has only an `<address>` containing a UK postcode. The KMZ plugin:

1. Uses `<Point>` if present.
2. Falls back to extracting the postcode (regex `[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}`) and geocoding via MapTiler with `proximity=-0.2,51.15` for SE-England bias. Postcodes geocode reliably; full addresses confuse the geocoder.
3. Projects the resulting point onto the polyline so the marker sits on the route line, not the nearest road.

Results live in [data-config/waypoint-cache.json](data-config/waypoint-cache.json), keyed by the geocoder query string (postcode). The file is **the source of truth**: if the geocoder picks the wrong place, edit the entry by hand and it will stick.

## MapLibre patterns

- One GeoJSON source per year (`route-2026`, `historic-2021`, `historic-2022`). Historic sources start empty and get populated via `effect()` once `historic.value` resolves.
- Layer ordering matters: red (2021) → yellow (2022) → green (2026) so 2026 is on top.
- Three `maplibregl.Marker` instances for the user + two historic dots. Each is driven by its own `effect()` reading the relevant signal — `.addTo(map)` / `.remove()` based on whether the value is non-null.
- All `effect()` disposers are tracked and called on `useEffect` cleanup. Same for the popup.

## Build pipeline notes

- TypeScript runs as `tsc -b` for type-check only; Vite/Rolldown does the actual bundling. The plugins are loaded by Vite, so they can `import { ... } from '../src/geo/...'` even though that's cross-tsconfig — Vite's resolver handles it.
- `tsconfig.app.json` covers `src/`; `tsconfig.node.json` covers `vite.config.ts` + `plugins/**` + `data-config/**`.
- Wrangler is configured as assets-only ([wrangler.jsonc](wrangler.jsonc) has no `main`).

## Service worker

Not implemented yet. Designed-for: when the SW is added, it can read the Vite manifest and emit a precache list. Hashed asset names are fine because that list is regenerated each build.

## Things easy to get wrong

- **Editing `data/*.tcx` or `data/2026.kmz` by hand** — they're large and the plugins re-parse them on every cold start of Vite. Cached parse output lives in `node_modules/.vite/`; if you make a change and don't see it, restart `pnpm dev`.
- **Adding a new dependency that runs in the browser** — keep it in `devDependencies`. The whole app bundles statically; there's no `dependencies` section at runtime.
- **Changing the SE-England geocoding proximity** — `(-0.2, 51.15)` is hardcoded in [plugins/vite-plugin-kmz.ts](plugins/vite-plugin-kmz.ts). If the route ever moves, update or remove it.
- **The `t` param without `lat`/`lon` is supported** — the share button always emits `t` and only emits `lat`/`lon` if a position is known. Don't reintroduce the "shared mode is all-or-nothing" assumption.
- **`initLifecycle()` must run after `mode.ts`** — the side-effectful import order in `App.tsx` matters.
