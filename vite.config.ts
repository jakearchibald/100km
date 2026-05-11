import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tcx from './plugins/vite-plugin-tcx.ts';
import kmz from './plugins/vite-plugin-kmz.ts';

export default defineConfig({
  plugins: [
    tcx(),
    kmz(),
    preact(),
    cloudflare({
      experimental: { headersAndRedirectsDevModeSupport: true },
    }),
  ],
});
