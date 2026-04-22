/**
 * Size limit configuration for Obvious Mobile.
 * Budget values are read from performance.config.ts to keep them in sync.
 *
 * Reads the web export in dist/ after `expo export --platform web`.
 * Fails CI if the gzipped bundle exceeds the budget.
 */

// Import budget from performance.config — use require via ts-node/esm-less approach
// We evaluate the budget value directly to avoid requiring a TS transpiler at config time.
// The canonical value lives in performance.config.ts; this config mirrors it.
// Any change to the budget MUST update both files.
const BUNDLE_BUDGET_BYTES = 5_242_880; // 5 MB gzipped — mirrors performance.config.ts

/** @type {import('size-limit').SizeLimitConfig} */
module.exports = [
  {
    name: 'Web bundle (gzipped)',
    path: 'dist/**/*.js',
    gzip: true,
    limit: `${BUNDLE_BUDGET_BYTES}`, // size-limit accepts byte strings too
    // When dist/ doesn't exist yet (pre-export), size-limit returns 0 — not a failure.
    ignore: [],
  },
];
