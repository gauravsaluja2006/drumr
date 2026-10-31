import { defineConfig, type Plugin } from 'vite';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * In `--mode test` builds, ship the synthetic fixture kits at /test-kits/ (see .env.test) so
 * e2e tests never depend on the real kits in public/kits.
 */
function fixtureKits(): Plugin {
  let outDir = 'dist';
  return {
    name: 'drumr-fixture-kits',
    apply: (_config, env) => env.mode === 'test' && env.command === 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      cpSync(fileURLToPath(new URL('./tests/fixtures/kits', import.meta.url)), join(outDir, 'test-kits'), {
        recursive: true,
      });
    },
  };
}

// GitHub Pages serves the app under /drumr/. Locally and in tests it is served at /.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    fixtureKits(),
    // Offline support (docs/04-ROADMAP.md Phase 7). The app shell is precached; kit files are
    // cached on use (audio cache-first, JSON stale-while-revalidate). See src/app/offline.ts.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icons/*.png', 'og-image.png'],
      manifest: {
        name: 'Drumr — acoustic drums for your MIDI pads',
        short_name: 'Drumr',
        description: 'Play acoustic drum kits in the browser with any USB MIDI pad controller.',
        theme_color: '#0b0c0f',
        background_color: '#0b0c0f',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}'],
        // Only Latin font subsets are precached; others load on demand via unicode-range.
        globIgnores: [
          'kits/**',
          'test-kits/**',
          '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
        ],
        navigateFallback: 'index.html',
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /\/(test-)?kits\/.*\.(flac|wav)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drumr-kit-audio',
              expiration: { maxEntries: 1000 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/(test-)?kits\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'drumr-kit-json', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
  build: { target: 'es2022', sourcemap: true },
});
