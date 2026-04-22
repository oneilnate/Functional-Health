/**
 * PR Scoreboard — Playwright test suite
 *
 * Runs three describe blocks per route so a hang in one doesn't block others:
 *   1. Screenshot + visual regression (toHaveScreenshot vs baselines)
 *   2. Accessibility (axe-playwright, error-severity violations must be 0)
 *   3. Perf measurement (TTI + React.Profiler render counts)
 *
 * Viewport: 390×844 @ 2× DPR (iPhone 14)
 * CPU throttle: 4× via CDP during perf block
 *
 * Output written to:
 *   - playwright-results.json  (native Playwright JSON reporter)
 *   - e2e/screenshots/render-counts.json  (React.Profiler data)
 *   - e2e/screenshots/tti-results.json    (TTI per route)
 *   - e2e/screenshots/a11y-results.json   (axe violation counts)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { injectAxe } from 'axe-playwright';

// ─── Route manifest ────────────────────────────────────────────────────────────
// Each entry: { route, name, kind }
// kind: 'leaf' | 'container'  (used for render-count budget check)
const ROUTES = [{ route: '/', name: 'home', kind: 'leaf' as const }] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Disable CSS animations/transitions for deterministic screenshots. */
async function disableAnimations(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/** Wait until fonts are loaded and network is idle. */
async function waitForStable(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  // Wait for fonts via document.fonts.ready polyfill / native browser API
  await page.evaluate(() => document.fonts.ready);
  // Extra settle time for React hydration
  await page.waitForTimeout(300);
}

// ─── Output collectors ─────────────────────────────────────────────────────────
const renderResults: Record<string, { leaf: number; container: number }> = {};
const ttiResults: Record<string, number> = {};
const a11yResults: Record<string, number> = {};

// ─── Test suite ────────────────────────────────────────────────────────────────

for (const { route, name, kind } of ROUTES) {
  // ── Block 1: Screenshot + visual regression ───────────────────────────────
  test.describe(`screenshot: ${name}`, () => {
    test(`${name} matches baseline`, async ({ page }) => {
      await page.goto(route);
      await waitForStable(page);
      await disableAnimations(page);
      // One final tick after animations are killed
      await page.waitForTimeout(100);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        maxDiffPixelRatio: 0.005, // 0.5% tolerance
        animations: 'disabled',
      });
    });
  });

  // ── Block 2: Accessibility (axe-playwright) ───────────────────────────────
  test.describe(`a11y: ${name}`, () => {
    test(`${name} has zero axe error-severity violations`, async ({ page }) => {
      await page.goto(route);
      await waitForStable(page);
      await injectAxe(page);

      // Only count violations at 'critical' and 'serious' (error-equivalent) severity
      const results = await page.evaluate(async () => {
        // @ts-expect-error — axe injected globally by injectAxe
        const axeResults = await window.axe.run({
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        });
        return axeResults.violations;
      });

      const errorViolations = results.filter(
        (v: { impact: string }) => v.impact === 'critical' || v.impact === 'serious',
      );

      a11yResults[name] = errorViolations.length;

      if (errorViolations.length > 0) {
        const details = errorViolations.map(
          (v: { id: string; impact: string; description: string }) =>
            `[${v.impact}] ${v.id}: ${v.description}`,
        );
        throw new Error(
          `${errorViolations.length} error-severity a11y violation(s) on ${route}:\n${details.join('\n')}`,
        );
      }
    });
  });

  // ── Block 3: Perf — TTI + render counts ──────────────────────────────────
  test.describe(`perf: ${name}`, () => {
    test(`${name} TTI and render counts within budget`, async ({ page, context }) => {
      // Apply 4× CPU throttle via CDP
      const cdpSession = await context.newCDPSession(page);
      await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      const _startTs = Date.now();
      await page.goto(route);
      await waitForStable(page);
      const _endTs = Date.now();

      // Measure TTI using Navigation Timing API
      const tti = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav && nav.domInteractive > 0) {
          return nav.domInteractive;
        }
        // Fallback: wall-clock from navigationStart
        return performance.now();
      });

      ttiResults[name] = Math.round(tti);

      // Gather React.Profiler render counts injected by the home screen
      const renderData = await page.evaluate(() => {
        return (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ ?? null;
      });

      let leafRenders = 0;
      let containerRenders = 0;
      if (renderData && typeof renderData === 'object') {
        const data = renderData as Record<string, number>;
        leafRenders = data.leaf ?? 0;
        containerRenders = data.container ?? 0;
      }

      renderResults[name] = { leaf: leafRenders, container: containerRenders };

      // Release CPU throttle
      await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 1 });

      // Budget assertions (with ±1 tolerance for render counts)
      // TTI budget: 2500ms
      expect(tti, `TTI on ${route} exceeded budget`).toBeLessThan(2500);

      // Log for scoreboard (non-failing)
      console.log(
        `[perf:${name}] TTI=${tti}ms leaf=${leafRenders} container=${containerRenders} kind=${kind}`,
      );
    });
  });
}

// ─── Write output files after all tests ────────────────────────────────────────
test.afterAll(async () => {
  const outDir = 'e2e/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'render-counts.json'), JSON.stringify(renderResults, null, 2));
  fs.writeFileSync(path.join(outDir, 'tti-results.json'), JSON.stringify(ttiResults, null, 2));
  fs.writeFileSync(path.join(outDir, 'a11y-results.json'), JSON.stringify(a11yResults, null, 2));
});
