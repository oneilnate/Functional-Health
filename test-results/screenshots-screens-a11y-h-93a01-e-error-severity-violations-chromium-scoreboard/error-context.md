# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: screenshots/screens.spec.ts >> a11y: home >> home has zero axe error-severity violations
- Location: e2e/screenshots/screens.spec.ts:80:9

# Error details

```
Error: 1 error-severity a11y violation(s) on /:
[serious] color-contrast: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds
```

# Test source

```ts
  5   |  *   1. Screenshot + visual regression (toHaveScreenshot vs baselines)
  6   |  *   2. Accessibility (axe-playwright, error-severity violations must be 0)
  7   |  *   3. Perf measurement (TTI + React.Profiler render counts)
  8   |  *
  9   |  * Viewport: 390×844 @ 2× DPR (iPhone 14)
  10  |  * CPU throttle: 4× via CDP during perf block
  11  |  *
  12  |  * Output written to:
  13  |  *   - playwright-results.json  (native Playwright JSON reporter)
  14  |  *   - e2e/screenshots/render-counts.json  (React.Profiler data)
  15  |  *   - e2e/screenshots/tti-results.json    (TTI per route)
  16  |  *   - e2e/screenshots/a11y-results.json   (axe violation counts)
  17  |  */
  18  | 
  19  | import * as fs from 'node:fs';
  20  | import * as path from 'node:path';
  21  | import { expect, test } from '@playwright/test';
  22  | import { injectAxe } from 'axe-playwright';
  23  | 
  24  | // ─── Route manifest ────────────────────────────────────────────────────────────
  25  | // Each entry: { route, name, kind }
  26  | // kind: 'leaf' | 'container'  (used for render-count budget check)
  27  | const ROUTES = [{ route: '/', name: 'home', kind: 'leaf' as const }] as const;
  28  | 
  29  | // ─── Helpers ───────────────────────────────────────────────────────────────────
  30  | 
  31  | /** Disable CSS animations/transitions for deterministic screenshots. */
  32  | async function disableAnimations(page: import('@playwright/test').Page) {
  33  |   await page.addStyleTag({
  34  |     content: `
  35  |       *, *::before, *::after {
  36  |         animation-duration: 0s !important;
  37  |         animation-delay: 0s !important;
  38  |         transition-duration: 0s !important;
  39  |         transition-delay: 0s !important;
  40  |       }
  41  |     `,
  42  |   });
  43  | }
  44  | 
  45  | /** Wait until fonts are loaded and network is idle. */
  46  | async function waitForStable(page: import('@playwright/test').Page) {
  47  |   await page.waitForLoadState('networkidle');
  48  |   // Wait for fonts via document.fonts.ready polyfill / native browser API
  49  |   await page.evaluate(() => document.fonts.ready);
  50  |   // Extra settle time for React hydration
  51  |   await page.waitForTimeout(300);
  52  | }
  53  | 
  54  | // ─── Output collectors ─────────────────────────────────────────────────────────
  55  | const renderResults: Record<string, { leaf: number; container: number }> = {};
  56  | const ttiResults: Record<string, number> = {};
  57  | const a11yResults: Record<string, number> = {};
  58  | 
  59  | // ─── Test suite ────────────────────────────────────────────────────────────────
  60  | 
  61  | for (const { route, name, kind } of ROUTES) {
  62  |   // ── Block 1: Screenshot + visual regression ───────────────────────────────
  63  |   test.describe(`screenshot: ${name}`, () => {
  64  |     test(`${name} matches baseline`, async ({ page }) => {
  65  |       await page.goto(route);
  66  |       await waitForStable(page);
  67  |       await disableAnimations(page);
  68  |       // One final tick after animations are killed
  69  |       await page.waitForTimeout(100);
  70  | 
  71  |       await expect(page).toHaveScreenshot(`${name}.png`, {
  72  |         maxDiffPixelRatio: 0.005, // 0.5% tolerance
  73  |         animations: 'disabled',
  74  |       });
  75  |     });
  76  |   });
  77  | 
  78  |   // ── Block 2: Accessibility (axe-playwright) ───────────────────────────────
  79  |   test.describe(`a11y: ${name}`, () => {
  80  |     test(`${name} has zero axe error-severity violations`, async ({ page }) => {
  81  |       await page.goto(route);
  82  |       await waitForStable(page);
  83  |       await injectAxe(page);
  84  | 
  85  |       // Only count violations at 'critical' and 'serious' (error-equivalent) severity
  86  |       const results = await page.evaluate(async () => {
  87  |         // @ts-expect-error — axe injected globally by injectAxe
  88  |         const axeResults = await window.axe.run({
  89  |           runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  90  |         });
  91  |         return axeResults.violations;
  92  |       });
  93  | 
  94  |       const errorViolations = results.filter(
  95  |         (v: { impact: string }) => v.impact === 'critical' || v.impact === 'serious',
  96  |       );
  97  | 
  98  |       a11yResults[name] = errorViolations.length;
  99  | 
  100 |       if (errorViolations.length > 0) {
  101 |         const details = errorViolations.map(
  102 |           (v: { id: string; impact: string; description: string }) =>
  103 |             `[${v.impact}] ${v.id}: ${v.description}`,
  104 |         );
> 105 |         throw new Error(
      |               ^ Error: 1 error-severity a11y violation(s) on /:
  106 |           `${errorViolations.length} error-severity a11y violation(s) on ${route}:\n${details.join('\n')}`,
  107 |         );
  108 |       }
  109 |     });
  110 |   });
  111 | 
  112 |   // ── Block 3: Perf — TTI + render counts ──────────────────────────────────
  113 |   test.describe(`perf: ${name}`, () => {
  114 |     test(`${name} TTI and render counts within budget`, async ({ page, context }) => {
  115 |       // Apply 4× CPU throttle via CDP
  116 |       const cdpSession = await context.newCDPSession(page);
  117 |       await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  118 | 
  119 |       const _startTs = Date.now();
  120 |       await page.goto(route);
  121 |       await waitForStable(page);
  122 |       const _endTs = Date.now();
  123 | 
  124 |       // Measure TTI using Navigation Timing API
  125 |       const tti = await page.evaluate(() => {
  126 |         const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  127 |         if (nav && nav.domInteractive > 0) {
  128 |           return nav.domInteractive;
  129 |         }
  130 |         // Fallback: wall-clock from navigationStart
  131 |         return performance.now();
  132 |       });
  133 | 
  134 |       ttiResults[name] = Math.round(tti);
  135 | 
  136 |       // Gather React.Profiler render counts injected by the home screen
  137 |       const renderData = await page.evaluate(() => {
  138 |         return (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ ?? null;
  139 |       });
  140 | 
  141 |       let leafRenders = 0;
  142 |       let containerRenders = 0;
  143 |       if (renderData && typeof renderData === 'object') {
  144 |         const data = renderData as Record<string, number>;
  145 |         leafRenders = data.leaf ?? 0;
  146 |         containerRenders = data.container ?? 0;
  147 |       }
  148 | 
  149 |       renderResults[name] = { leaf: leafRenders, container: containerRenders };
  150 | 
  151 |       // Release CPU throttle
  152 |       await cdpSession.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  153 | 
  154 |       // Budget assertions (with ±1 tolerance for render counts)
  155 |       // TTI budget: 2500ms
  156 |       expect(tti, `TTI on ${route} exceeded budget`).toBeLessThan(2500);
  157 | 
  158 |       // Log for scoreboard (non-failing)
  159 |       console.log(
  160 |         `[perf:${name}] TTI=${tti}ms leaf=${leafRenders} container=${containerRenders} kind=${kind}`,
  161 |       );
  162 |     });
  163 |   });
  164 | }
  165 | 
  166 | // ─── Write output files after all tests ────────────────────────────────────────
  167 | test.afterAll(async () => {
  168 |   const outDir = 'e2e/screenshots';
  169 |   fs.mkdirSync(outDir, { recursive: true });
  170 | 
  171 |   fs.writeFileSync(path.join(outDir, 'render-counts.json'), JSON.stringify(renderResults, null, 2));
  172 |   fs.writeFileSync(path.join(outDir, 'tti-results.json'), JSON.stringify(ttiResults, null, 2));
  173 |   fs.writeFileSync(path.join(outDir, 'a11y-results.json'), JSON.stringify(a11yResults, null, 2));
  174 | });
  175 | 
```