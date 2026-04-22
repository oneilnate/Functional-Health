# mood

## Purpose

<!-- TODO: fill in before implementing this module -->
Handles mood logging, mood history, and mood trend analysis. Exists as a separate module
because mood data has a distinct logging UX (quick-entry, emoji-scale) and needs to
correlate with other signals (energy, workouts) without owning those domains.

## Responsibilities

Owns:
- Mood entry creation, editing, and deletion
- Mood history data and local state
- Mood trend aggregation (daily/weekly averages)

Does NOT own:
- Correlation analysis with other modules (cross-module concern; not yet defined)
- Notification scheduling for mood reminders (belongs in a future `notifications` module)
- Display UI beyond shared primitives in `src/components/`

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useMoodLog } from './hooks/useMoodLog'
// export { useMoodHistory } from './hooks/useMoodHistory'
// export type { MoodEntry, MoodScale, MoodTrend } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 3 (leaf screen — mood entry is a simple form)
- Quick-entry interaction response: < 100 ms (tap → visual feedback)
- History list: show last 30 days by default; paginate beyond that

## Closed-loop check

```bash
# Run before every commit that touches src/modules/mood/
pnpm test --run src/modules/mood
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: mood scale representation (numeric 1–10 vs emoji set vs both)
- Decision: local-first vs server-first logging
- Decision: how mood entries relate to timestamp granularity

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/mood.service.ts`.
- Forbidden: reading energy or workout data directly; use service functions instead.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
