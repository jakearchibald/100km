import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tcx from './plugins/vite-plugin-tcx.ts';
import kmz from './plugins/vite-plugin-kmz.ts';
import bundleStats from './plugins/vite-plugin-bundle-stats.ts';

const enableStats = process.env.STATS === '1';

export default defineConfig({
  plugins: [
    tcx(),
    kmz(),
    preact(),
    cloudflare({
      experimental: { headersAndRedirectsDevModeSupport: true },
    }),
    ...(enableStats ? [bundleStats()] : []),
  ],
});
