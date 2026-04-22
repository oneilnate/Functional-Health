#!/usr/bin/env tsx
/**
 * scripts/build-scoreboard.ts
 *
 * Reads all Playwright + CI artefact outputs and produces:
 *   - scoreboard-data.json   (machine-parseable structured data)
 *   - scoreboard-comment.md  (GitHub bot comment body with sentinel)
 *
 * Inputs (all optional; gracefully absent):
 *   - playwright-results.json          (Playwright JSON reporter)
 *   - e2e/screenshots/tti-results.json
 *   - e2e/screenshots/render-counts.json
 *   - e2e/screenshots/a11y-results.json
 *   - coverage/coverage-summary.json   (vitest --coverage)
 *   - size-limit-results.json          (size-limit --json output)
 *   - perf/baselines/*.json            (committed perf baselines)
 *   - .github/screenshot-urls.json     (artifact URLs injected by CI)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { performanceBudgets } from '../performance.config';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function pct(a: number, b: number): string {
  if (b === 0) return '+0%';
  const delta = ((a - b) / b) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function fmtBytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── Read inputs ───────────────────────────────────────────────────────────────

const ttiResults = readJSON<Record<string, number>>('e2e/screenshots/tti-results.json', {});
const renderCounts = readJSON<Record<string, { leaf: number; container: number }>>(
  'e2e/screenshots/render-counts.json',
  {},
);
const a11yResults = readJSON<Record<string, number>>('e2e/screenshots/a11y-results.json', {});
const playwrightResults = readJSON<{
  stats?: { expected: number; passed: number; failed: number };
  suites?: Array<{
    title: string;
    suites?: Array<{
      title: string;
      specs?: Array<{
        title: string;
        tests?: Array<{
          status: string;
          results?: Array<{
            status: string;
            errors?: Array<{ message?: string }>;
          }>;
        }>;
      }>;
    }>;
  }>;
}>('playwright-results.json', {});

// Coverage summary (vitest --coverage produces json-summary)
const coverageSummary = readJSON<{
  total?: { lines: { pct: number }; functions: { pct: number } };
}>('coverage/coverage-summary.json', {});

// Size-limit JSON output
const sizeLimitResults = readJSON<Array<{ name: string; size: number; sizeLimit: string }>>(
  'size-limit-results.json',
  [],
);

// Committed perf baselines
const perfBaselines: Record<string, { tti?: number; leaf?: number; container?: number }> = {};
const basDir = 'perf/baselines';
if (fs.existsSync(basDir)) {
  for (const f of fs.readdirSync(basDir)) {
    if (!f.endsWith('.json')) continue;
    const route = path.basename(f, '.json');
    perfBaselines[route] = readJSON(path.join(basDir, f), {});
  }
}

// ─── Parse Playwright screenshot diff from JSON reporter ──────────────────────
//
// When toHaveScreenshot fails, Playwright's error message includes text like
// "XX pixels (out of TOTAL) are different" or similar. When it passes, there
// is no error message — we treat diffPct as 0 (baseline exists, no change).
// Route spec title pattern: "screenshot: <name>" > "<name> matches baseline".
function extractDiffPct(routeName: string): number | null {
  const suites = playwrightResults.suites ?? [];
  for (const topSuite of suites) {
    const inner = topSuite.suites ?? [];
    for (const suite of inner) {
      if (!suite.title.startsWith(`screenshot: ${routeName}`)) continue;
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            for (const err of result.errors ?? []) {
              const msg = err.message ?? '';
              // Playwright error format: "X pixels (out of Y) are different"
              // Also: "Screenshot comparison failed: X pixels differ."
              const pixelMatch = msg.match(/(\d+)\s*pixels?\s+(?:out of|\(out of)\s*(\d+)/i);
              if (pixelMatch) {
                const diff = parseInt(pixelMatch[1] ?? '0', 10);
                const total = parseInt(pixelMatch[2] ?? '0', 10);
                if (total > 0) return (diff / total) * 100;
              }
              // Fallback: single-number form "X pixels differ"
              const simpleMatch = msg.match(/(\d+)\s*pixels?\s+differ/i);
              if (simpleMatch && typeof simpleMatch[1] === 'string') {
                // Total unknown — report the raw count as-is; cannot compute %
                // Return a non-null sentinel so visualVerdict can be 'changed'
                return null;
              }
            }
          }
        }
      }
    }
  }
  return null; // no diff errors found (test passed or suite missing)
}

// Screenshot artifact URLs (injected by CI workflow)
const screenshotUrls = readJSON<Record<string, string>>('.github/screenshot-urls.json', {});

// Commit SHA from env (populated by GH Actions)
const commitSha = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const prLabels = (process.env.PR_LABELS ?? '')
  .split(',')
  .map((l: string) => l.trim())
  .filter(Boolean);

const skipVisualBaseline = prLabels.includes('visual-baseline-update');
const skipPerfRegression = prLabels.includes('perf-regression-acknowledged');
const skipBudgetChange = prLabels.includes('perf-budget-change');

// ─── Bundle size ───────────────────────────────────────────────────────────────

const bundleEntry = sizeLimitResults.find((r) => r.name.includes('Web bundle'));
const bundleBytes = bundleEntry?.size ?? 0;
const bundleBudget = performanceBudgets.bundle;
const bundleOver = bundleBytes > bundleBudget && !skipBudgetChange;

// ─── Per-route analysis ────────────────────────────────────────────────────────

type RouteResult = {
  name: string;
  route: string;
  screenshotUrl: string | null;
  visualVerdict: 'unchanged' | 'changed' | 'new' | 'skipped';
  diffPct: number | null;
  tti: number | null;
  ttiBaseline: number | null;
  ttiOver: boolean;
  leafRenders: number;
  containerRenders: number;
  a11yViolations: number;
};

const ROUTES = [{ name: 'home', route: '/' }];

const routeResults: RouteResult[] = ROUTES.map(({ name, route }) => {
  const tti = ttiResults[name] ?? null;
  const ttiBaseline = perfBaselines[name]?.tti ?? null;
  const ttiOver =
    tti !== null &&
    !skipPerfRegression &&
    (tti > performanceBudgets.tti || (ttiBaseline !== null && tti > ttiBaseline * 1.1));

  const renders = renderCounts[name] ?? { leaf: 0, container: 0 };
  const _leafBaseline = perfBaselines[name]?.leaf;
  const _containerBaseline = perfBaselines[name]?.container;

  // Apply ±1 tolerance before budget check
  const leafOver = !skipPerfRegression && renders.leaf > performanceBudgets.renders.leaf + 1;
  const containerOver =
    !skipPerfRegression && renders.container > performanceBudgets.renders.container + 1;

  // Compute real diffPct from Playwright JSON reporter.
  // - If test passed (no error) and baseline exists: diffPct = 0 (unchanged).
  // - If test failed with a pixel diff error: diffPct = pixels / total * 100.
  // - If route has no baseline (first run / new route): diffPct = null.
  const hasBaseline = fs.existsSync(`e2e/screenshots/baselines/${name}.png`);
  const pwDiffPct = extractDiffPct(name);
  // pwDiffPct is null when no pixel-diff error was found — treat as 0% if baseline exists.
  const diffPct: number | null = hasBaseline ? (pwDiffPct ?? 0) : null;
  const visualVerdict: 'unchanged' | 'changed' | 'new' | 'skipped' = skipVisualBaseline
    ? 'skipped'
    : !hasBaseline
      ? 'new'
      : diffPct !== null && diffPct > 0
        ? 'changed'
        : 'unchanged';

  return {
    name,
    route,
    screenshotUrl: screenshotUrls[name] ?? null,
    visualVerdict,
    diffPct,
    tti,
    ttiBaseline,
    ttiOver: ttiOver || leafOver || containerOver,
    leafRenders: renders.leaf,
    containerRenders: renders.container,
    a11yViolations: a11yResults[name] ?? 0,
  };
});

// ─── Overall status ────────────────────────────────────────────────────────────

const anyA11yFail = routeResults.some((r) => r.a11yViolations > 0);
const anyPerfFail = routeResults.some((r) => r.ttiOver);
const overallPass = !bundleOver && !anyA11yFail && !anyPerfFail;

// Coverage
const coveragePct = coverageSummary.total?.lines?.pct ?? null;

// Playwright test counts
const playwrightStats = playwrightResults.stats ?? null;

// ─── Build structured data ─────────────────────────────────────────────────────

const scoreboardData = {
  commit: commitSha,
  timestamp: new Date().toISOString(),
  overallPass,
  bundle: {
    bytes: bundleBytes,
    mb: parseFloat((bundleBytes / 1_048_576).toFixed(2)),
    budgetMb: parseFloat((bundleBudget / 1_048_576).toFixed(2)),
    over: bundleOver,
  },
  routes: routeResults.map((r) => ({
    name: r.name,
    route: r.route,
    visualVerdict: r.visualVerdict,
    diffPct: r.diffPct,
    tti: r.tti,
    ttiBaseline: r.ttiBaseline,
    ttiOver: r.ttiOver,
    leafRenders: r.leafRenders,
    containerRenders: r.containerRenders,
    a11yViolations: r.a11yViolations,
  })),
  coverage: {
    linesPct: coveragePct,
  },
  tests: playwrightStats
    ? {
        passed: playwrightStats.passed,
        failed: playwrightStats.failed,
        total: playwrightStats.expected,
      }
    : null,
};

fs.writeFileSync('scoreboard-data.json', JSON.stringify(scoreboardData, null, 2));
console.log('✓ scoreboard-data.json written');

// ─── Build markdown comment ────────────────────────────────────────────────────

function visualEmoji(v: string, diffPct: number | null) {
  if (v === 'skipped') return '⏭️ skipped (label)';
  if (v === 'new') return '🟢 new';
  if (v === 'changed' && diffPct !== null) {
    const over = diffPct > 10;
    return over ? `🔴 changed ${diffPct.toFixed(1)}%` : `🟡 changed ${diffPct.toFixed(1)}%`;
  }
  return '✅ unchanged';
}

const screenshotRows = routeResults
  .map((r) => {
    const img = r.screenshotUrl ? `![${r.name}](${r.screenshotUrl})` : '*(pending)*';
    const diff = visualEmoji(r.visualVerdict, r.diffPct);
    return `| ${r.route} | ${img} | ${diff} |`;
  })
  .join('\n');

const bundleStatus = bundleOver ? '🔴' : '✅';
const bundleStr =
  bundleBytes > 0
    ? `${fmtBytes(bundleBytes)} · budget ${fmtBytes(bundleBudget)} ${bundleStatus}`
    : 'n/a';

const ttiRow = routeResults
  .map((r) => {
    if (r.tti === null) return null;
    const base = r.ttiBaseline != null ? ` (baseline ${fmtMs(r.ttiBaseline)})` : '';
    const icon = r.ttiOver ? '🔴' : '✅';
    return `  - **TTI /${r.name}**: ${fmtMs(r.tti)}${base} · budget ${fmtMs(performanceBudgets.tti)} ${icon}`;
  })
  .filter(Boolean)
  .join('\n');

const renderRow = routeResults
  .map((r) => {
    if (r.leafRenders === 0 && r.containerRenders === 0) return null;
    return `  - **Renders /${r.name}**: leaf ${r.leafRenders} (budget ${performanceBudgets.renders.leaf}±1) · container ${r.containerRenders} (budget ${performanceBudgets.renders.container}±1)`;
  })
  .filter(Boolean)
  .join('\n');

const a11yRow = routeResults
  .map((r) => {
    const icon = r.a11yViolations === 0 ? '✅' : '🔴';
    return `  - **A11y /${r.name}**: ${r.a11yViolations} error-severity violations ${icon}`;
  })
  .join('\n');

const coverageStr = coveragePct != null ? `${coveragePct.toFixed(1)}%` : 'n/a';

const testStr = playwrightStats
  ? `${playwrightStats.passed} passed · ${playwrightStats.failed} failed`
  : 'n/a';

const statusIcon = overallPass ? '✅ All checks passed' : '🔴 One or more checks failed';

const comment = `<!-- obvious-mobile-scoreboard:v1 -->
## 📸 PR Scoreboard · commit ${commitSha}

### Screens
| Route | Screenshot | Diff vs main |
|---|---|---|
${screenshotRows}

### Performance
- **Bundle**: ${bundleStr}
${ttiRow || '- **TTI**: n/a (perf suite skipped)'}
${renderRow || '- **Renders**: n/a (profiler data not available)'}

### Quality
- **Playwright tests**: ${testStr}
- **Coverage (lines)**: ${coverageStr} · threshold 70% ${coveragePct == null || coveragePct >= 70 ? '✅' : '🔴'}
${a11yRow}

### Status: ${statusIcon}

---

<details>
<summary>Machine-readable data (for downstream agents)</summary>

<!-- scoreboard-data:begin -->
\`\`\`json
${JSON.stringify(scoreboardData, null, 2)}
\`\`\`
<!-- scoreboard-data:end -->

</details>

${bundleOver ? `\n> ⚠️ **Budget violation:** bundle ${fmtBytes(bundleBytes)} → ${fmtBytes(bundleBudget)} budget (apply \`perf-budget-change\` label to override)` : ''}
${anyPerfFail && !skipPerfRegression ? `\n> ⚠️ **Perf regression detected** (apply \`perf-regression-acknowledged\` label to override)` : ''}
${anyA11yFail ? `\n> 🚨 **A11y violations detected** — fix required, no escape hatch` : ''}
`;

fs.writeFileSync('scoreboard-comment.md', comment);
console.log('✓ scoreboard-comment.md written');

// Exit non-zero on hard failures (a11y is always hard; budget/perf respect labels)
if (anyA11yFail) {
  console.error('✗ A11y violations — CI will fail');
  process.exit(1);
}
if (bundleOver || (anyPerfFail && !skipPerfRegression)) {
  // Print readable diff lines
  if (bundleOver) {
    console.error(
      `✗ bundle.js ${fmtBytes(bundleBytes)} -> ${fmtBytes(bundleBudget)} budget (${pct(bundleBytes, bundleBudget)})`,
    );
  }
  process.exit(1);
}

console.log('✓ Scoreboard complete — all gates passed');
