import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx}', 'scripts/**/__tests__/**/*.test.ts'],
      setupFiles: ['tests/unit/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/**/index.ts', 'src/**/*.d.ts'],
        thresholds: {
          lines: 80,
          'src/{engine,midi,mapping,kits}/**': { lines: 90, branches: 85 },
        },
      },
    },
  }),
);
