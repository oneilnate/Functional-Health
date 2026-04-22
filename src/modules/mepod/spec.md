# mepod

## Purpose

<!-- TODO: fill in before implementing this module -->
Aggregates and surfaces the user's personal health data pod (MePod): a unified view of
metrics from workouts, mood, food, and energy. Exists as a separate module because
aggregation logic across domains is complex and should not live in any single domain module
or in a screen.

## Responsibilities

Owns:
- Cross-module data aggregation (reads from other modules via service layer)
- MePod summary data model and caching
- Health score computation (composite of multiple signals)

Does NOT own:
- Raw data for any individual domain (owned by auth, feed, workouts, mood, food, energy)
- HealthKit integration (post-MVP; deferred)
- UI rendering beyond typed data (belongs in `src/app/` screens)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useMepod } from './hooks/useMepod'
// export { useHealthScore } from './hooks/useHealthScore'
// export type { MepodSummary, HealthScore, MetricSlice } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 6 (container screen — dashboard with multiple metric slices)
- Aggregation computation: < 200 ms (memoized; runs on data change, not every render)
- No waterfall fetching — parallel React Query calls for each domain slice

## Closed-loop check

```bash
# Run before every commit that touches src/modules/mepod/
pnpm test --run src/modules/mepod
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: aggregation triggers (polling vs event-driven vs on-mount)
- Decision: health score formula and weighting between signals
- Decision: how to handle missing data for a domain (user hasn't logged food today)

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: importing directly from other module internals (only use their public API / index.ts).
- Forbidden: calling fetch directly — use service functions from `src/services/`.
- Aggregation must be memoized; do not recompute on every render.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
