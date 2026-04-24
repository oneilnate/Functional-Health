import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';

export default defineConfig({
  plugins: [reactNative()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    // Exclude Playwright e2e tests — they run via playwright test, not vitest
    // Exclude api/ subdirectory — it has its own vitest config and pnpm workspace
    exclude: ['e2e/**', 'node_modules/**', 'api/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'lcov'],
      // Thresholds scoped to src/modules/** (PR 3 adds module directories)
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      include: ['src/modules/**', 'src/engine/**'],
      exclude: [
        'src/app/**',
        'src/types/**',
        'src/modules/**/*.tsx',
        'src/modules/**/index.ts',
        'src/engine/fixtures/**',
        'src/engine/index.ts',
        'src/engine/types.ts',
        'src/engine/card-catalog.json',
      ],
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
