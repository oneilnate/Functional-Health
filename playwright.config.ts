import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for PR scoreboard:
 * - Screenshots at 390×844 (iPhone 14 viewport) with retina scale
 * - CPU throttle 4× applied per test via CDP for TTI passes
 * - Animations disabled for deterministic screenshot capture
 * - Baselines in e2e/screenshots/baselines/
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Allow up to 0.5% pixel diff to tolerate minor sub-pixel rendering variance
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
    },
  },
  fullyParallel: false, // single worker keeps TTI measurements deterministic
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'playwright-results.json' }]],
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-scoreboard',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        channel: 'chromium',
        launchOptions: {
          args: [
            '--disable-web-security',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
          ],
        },
      },
    },
  ],
  // Snapshot directory for committed baselines
  snapshotDir: 'e2e/screenshots/baselines',
  snapshotPathTemplate: '{snapshotDir}/{testName}{ext}',
});
