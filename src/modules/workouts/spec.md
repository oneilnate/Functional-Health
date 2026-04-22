# workouts

## Purpose

<!-- TODO: fill in before implementing this module -->
Manages workout plans, active workout sessions, and workout history. Exists as a separate
module because workout tracking has significant local state (in-progress session timer,
set/rep tracking) that should not leak into global state or screens.

## Responsibilities

Owns:
- Workout plan data model and CRUD operations
- Active workout session state (in-progress timer, sets, reps)
- Workout history and completion records

Does NOT own:
- Nutrition data tied to workouts (belongs in `food` module)
- Energy level effects of workouts (belongs in `energy` module)
- Navigation between workout screens (belongs in `src/app/`)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useWorkoutSession } from './hooks/useWorkoutSession'
// export { useWorkoutHistory } from './hooks/useWorkoutHistory'
// export type { WorkoutPlan, WorkoutSession, Exercise } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 3 (leaf screen budget for workout detail)
- Session timer tick: no re-render of entire screen (isolate timer to a sub-component)
- History list: virtualized; no more than 20 items rendered at once

## Closed-loop check

```bash
# Run before every commit that touches src/modules/workouts/
pnpm test --run src/modules/workouts
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: local-first vs server-first session tracking
- Decision: timer implementation (setInterval vs Reanimated shared value)
- Decision: offline workout logging strategy

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/workouts.service.ts`.
- Forbidden: storing active session state in a screen component.
- Timer logic must not cause full-screen re-renders on each tick.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
