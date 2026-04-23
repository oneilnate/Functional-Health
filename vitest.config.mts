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
        functions: 60,  // RN component callbacks are JSX-inline; 60% is realistic
        branches: 65,
        statements: 70,
      },
      include: ['src/modules/feed/**'],
      exclude: [
        'src/app/**',
        'src/types/**',
        'src/modules/feed/spec.md',
        // Barrel re-export only — covered implicitly by component tests
        'src/modules/feed/index.ts',
        // FeedScreen requires full React context (renders all children)
        'src/modules/feed/components/FeedScreen.tsx',
        // useFeed is a React hook requiring full component lifecycle
        'src/modules/feed/hooks/useFeed.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': './src',
      '@fh/engine': './packages/engine/src/index.ts',
    },
  },
});
