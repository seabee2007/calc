import { webcrypto } from 'node:crypto';

// Make Node's Web Crypto available as globalThis.crypto
// (so Vite's `resolveConfig` can call getRandomValues())
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { productionRateReviewDevServer } from './vite-plugins/productionRateReviewDevServer';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  plugins: [
    react(),
    productionRateReviewDevServer(repoRoot),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'site.webmanifest',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
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
    })
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
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});