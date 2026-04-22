# food

## Purpose

<!-- TODO: fill in before implementing this module -->
Manages food logging, nutritional data, and meal history. Exists as a separate module
because nutrition tracking has its own data complexity (macros, micros, serving sizes,
food search) that is distinct from other health metrics.

## Responsibilities

Owns:
- Food entry creation and deletion (meal logging)
- Nutritional data model (calories, macros, micros)
- Daily nutrition summary aggregation
- Food search and lookup (via API or local database)

Does NOT own:
- Workout-nutrition correlation (cross-module; not yet defined)
- Barcode scanning UI (belongs in `src/app/` or a shared component)
- Grocery/marketplace food items (belongs in `marketplace` module)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useFoodLog } from './hooks/useFoodLog'
// export { useDailyNutrition } from './hooks/useDailyNutrition'
// export type { FoodEntry, NutritionData, Meal } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 3 (leaf screen for food entry)
- Food search: debounce at 300 ms; show results within 500 ms of debounce firing
- Nutrition summary: memoized; recomputes only when food log changes

## Closed-loop check

```bash
# Run before every commit that touches src/modules/food/
pnpm test --run src/modules/food
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: food database source (USDA, Open Food Facts, or proprietary API)
- Decision: serving size unit system (metric vs imperial vs both)
- Decision: offline food log storage strategy

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/food.service.ts`.
- Forbidden: accessing marketplace product data directly.
- Debounce all food search inputs to avoid excess API calls.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
