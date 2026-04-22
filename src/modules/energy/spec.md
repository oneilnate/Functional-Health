# energy

## Purpose

<!-- TODO: fill in before implementing this module -->
Tracks user energy levels throughout the day: logging, history, and trend display.
Exists as a separate module because energy tracking has its own quick-entry UX and
temporal patterns (hourly granularity) distinct from mood or workout tracking.

## Responsibilities

Owns:
- Energy level entry (numeric scale, quick-log UX)
- Energy history and daily/weekly trends
- Contextual tagging for energy entries (e.g., "post-workout", "after meal")

Does NOT own:
- Correlating energy to workouts or food (cross-module; not yet defined)
- Notification scheduling for energy check-ins (future `notifications` module)
- Sleep tracking (separate integration, post-MVP)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useEnergyLog } from './hooks/useEnergyLog'
// export { useEnergyTrends } from './hooks/useEnergyTrends'
// export type { EnergyEntry, EnergyScale, EnergyContext } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 3 (leaf screen — single quick-entry form)
- Quick-log interaction: < 100 ms tap-to-feedback
- Trend chart: rendered with static data only; no async on chart mount

## Closed-loop check

```bash
# Run before every commit that touches src/modules/energy/
pnpm test --run src/modules/energy
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: energy scale representation (1–10 numeric vs descriptive labels)
- Decision: logging frequency (on-demand vs prompted vs both)
- Decision: contextual tag taxonomy

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/energy.service.ts`.
- Forbidden: reading workout or food data directly in this module.
- Quick-log entry must not block the UI thread; keep it synchronous locally.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
