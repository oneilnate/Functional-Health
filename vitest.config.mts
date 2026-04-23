import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';

export default defineConfig({
  plugins: [reactNative()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    // Exclude Playwright e2e tests — they run via playwright test, not vitest
    exclude: ['e2e/**', 'node_modules/**'],
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
      include: ['src/modules/**', 'src/services/**'],
      exclude: [
        'src/app/**',
        'src/types/**',
        // RN components and hooks require RNTL/Playwright to test fully
        'src/modules/*/components/**',
        'src/modules/*/hooks/**',
        // Empty stub modules (not yet implemented)
        'src/modules/auth/**',
        'src/modules/energy/**',
        'src/modules/food/**',
        'src/modules/marketplace/**',
        'src/modules/mepod/**',
        'src/modules/mood/**',
        'src/modules/workouts/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
