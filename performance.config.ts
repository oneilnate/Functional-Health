/**
 * Performance budgets for Obvious Mobile.
 * These values are the authoritative source consumed by size-limit,
 * CI checks, and the PR scoreboard bot.
 *
 * Budget loosening requires the perf-budget-change label + human reviewer approval.
 */
export const performanceBudgets = {
  /** Web bundle size gzipped — checked by size-limit against dist/ */
  bundle: 5_242_880, // 5 MB gzipped

  /** Time-to-interactive on 4× throttled Chromium, measured in ms */
  tti: 2500,

  /** Maximum React render counts on screen mount */
  renders: {
    leaf: 3, // leaf screens (simple display screens)
    container: 6, // container screens (tabs, navigation wrappers)
  },

  /** Minimum Flashlight score (0–100) for Android runtime perf */
  flashlight: 80,
} as const;

export type PerformanceBudgets = typeof performanceBudgets;
