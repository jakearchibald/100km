/// <reference types="vite/client" />

declare module '*.tcx' {
  const value: import('./types').YearTrack;
  export default value;
}

declare module '*.kmz' {
  const value: import('./types').RouteData;
  export default value;
}

declare module '*.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}

declare module 'virtual:og-basemap' {
  export const basemapAssetPath: string;
  export const routePath: string;
  export const cumPx: number[];
  export const totalPx: number;
}

interface ImportMetaEnv {
  readonly VITE_MAPTILER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
