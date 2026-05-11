/// <reference types="vite/client" />

declare module '*.tcx' {
  const value: import('./types').YearTrack;
  export default value;
}

declare module '*.kmz' {
  const value: import('./types').RouteData;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_MAPTILER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
