import { defineConfig, type Plugin } from 'vite';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
  plugins: [react(), tailwindcss(), fixtureKits()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
  build: { target: 'es2022', sourcemap: true },
});
