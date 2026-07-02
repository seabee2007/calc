import { webcrypto } from 'node:crypto';

// Make Node's Web Crypto available as globalThis.crypto
// (so Vite's `resolveConfig` can call getRandomValues())
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { productionRateReviewDevServer } from './vite-plugins/productionRateReviewDevServer';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)));

// Report-only bundle analysis. Enabled via `npm run analyze` (ANALYZE=true);
// never active during normal `npm run build` / production deploys.
const analyze = process.env.ANALYZE === 'true';

export default defineConfig({
  plugins: [
    react(),
    productionRateReviewDevServer(repoRoot),
    VitePWA({
      // Use 'prompt' instead of 'autoUpdate' — autoUpdate silently reloads the
      // page when a new service worker activates, which can wipe unsaved form data.
      // With 'prompt', the app shows a "New version available" banner and lets the
      // user choose when to refresh.
      registerType: 'prompt',
      manifestFilename: 'site.webmanifest',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'apple-touch-icon-180x180.png',
        'icon-192.png',
        'icon-512.png',
        'og-image.png',
        'site.webmanifest',
      ],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/assets\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Arden Project OS',
        short_name: 'Arden',
          description: 'Construction project software for estimates, proposals, schedules, and field tracking.',
        start_url: '/',
        scope: '/',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
    watch: {
      usePolling: true
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization, apikey, X-Client-Info'
    }
  },
  // react-draggable (via react-grid-layout) references `process.env.DRAGGABLE_DEBUG`,
  // which throws in the browser because `process` is undefined. Replace that exact
  // token so the reference is compiled away in both app source and pre-bundled deps.
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    esbuildOptions: {
      define: {
        'process.env.DRAGGABLE_DEBUG': 'false',
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
});