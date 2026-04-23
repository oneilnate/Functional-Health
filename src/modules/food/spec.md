# Food Module — FoodPod

## Purpose

Implements the Food Pod home screen for snapping meals and unlocking a personalized
nutrition podcast. Owns all food UI components, TanStack Query hooks, camera capture,
and re-exports the `FoodScreen` mounted at `/food` in expo-router.

## Responsibilities

Owns:
- `UAHeader` — Under Armour NEXT branded header
- `FlexibilityCard` — static black card showing 72% flexibility score (no API)
- `FoodSnapCard` — white card with fork icon, dot grid, camera button, recent snaps scroll
- `DotGrid` — 30-dot progress grid (5×6), green = captured, #D9D9D9 = empty
- `UnlockedCard` — gray card shown when capturedCount >= DEMO_TARGET, opens TuneInModal
- `RewardPointsFooter` — static black card with 3,122 reward points
- `TuneInModal` — full-screen dark modal to confirm FoodPod generation and navigate to episode
- `usePod` hook — polls GET /api/pods/:id via TanStack Query
- `useUploadImage` mutation — optimistic increment, rollback on error
- `useCamera` (captureMeal) — expo-image-picker camera capture

Does NOT own:
- API fetch calls (lives in `src/services/food.service.ts`)
- App navigation setup (lives in `src/app/food/`)
- Episode player (E5 scope — stub at `src/app/food/episode/[podId].tsx`)

## Public API

```typescript
export { FoodSnapCard, FlexibilityCard, UAHeader, UnlockedCard, RewardPointsFooter, DotGrid, TuneInModal } from './components/*';
export { usePod, useUploadImage } from './hooks';
export { captureMeal } from './hooks/useCamera';
export { DEMO_TARGET, GRID_SIZE, DEMO_POD_ID } from './constants';
```

## Constants

- `DEMO_TARGET = 7` — meals required to unlock FoodPod for demo
- `GRID_SIZE = 30` — dots shown in grid (visual matches PNG)
- `DEMO_POD_ID = 'pod_demo_01'` — hardcoded demo pod

## Performance budget

- Renders on mount: ≤ 6 (container screen budget)

## Key decisions

- expo-image-picker (not expo-camera) keeps existing dep footprint
- DEMO_TARGET=7 for demo; grid still shows 30 dots so visual matches PNG
- Recent snaps are placeholder images (display-only, no backend storage)
- Flexibility card is static (72% / +5%) — no API calls
- Bearer token from EXPO_PUBLIC_DEMO_BEARER_TOKEN env var
- API base from EXPO_PUBLIC_API_BASE_URL (default: https://pear-sandbox.everbetter.com)
- TanStack Query provides optimistic updates and polling
- 404 from POST /images is acceptable while backend deploys

## Agent instructions

- Read this file before making any changes to this module.
- Run `pnpm typecheck && pnpm lint` before committing.
- Forbidden: calling fetch directly — use `src/services/food.service.ts`.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
