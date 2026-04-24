# food — Food Pod Module

## Purpose

Owns the client-side types, React Query hooks, and public API surface for the
Food Pod feature. A user captures ~30 meal images over 10 days, then receives a
personalised nutrition podcast.

This module does NOT own:
- Network calls (all fetch() lives in `src/services/food.service.ts`)
- Screen layout / navigation (lives in `src/app/food/`)
- Audio playback (expo-av, handled in the playback screen — F4-E3)
- Supabase storage upload (delegated to `useUploadMealImage` → `food.service.ts`)

## Responsibilities

Owns:
- `types.ts` — Pod, Meal, Podcast, GroundedFacts, and supporting status types
- `hooks.ts` — React Query wrappers (mutations + queries) over food.service
- `index.ts` — barrel export of types + hooks (no default export)

## Public API

### Types

```typescript
export type PodStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type MealStatus = 'pending_upload' | 'uploaded' | 'analyzed';
export type PipelineStage = 'vision' | 'grounding' | 'script' | 'tts' | 'upload';
export type StageState = 'pending' | 'running' | 'complete' | 'failed';
export type StageStatus = Partial<Record<PipelineStage, { status: StageState; ... }>>;
export type Meal = { id; podId; status; imageUrl?; capturedAt? };
export type Pod = { id; userId; status; timespanDays; mealsCount; mealsList; stageStatus; createdAt; completedAt?; groundedFacts? };
export type TranscriptSegment = { startSec; endSec; text; emphasisWords };
export type Podcast = { transcript: { segments; totalDurationSec; title }; audioUrl };
export type GroundedFacts = { aggregate; targets; gaps; patterns };
export type CreateMealResponse = { mealId; uploadUrl; storagePath };
```

### Hooks

| Hook | Type | Description |
|---|---|---|
| `useCreatePod()` | mutation | POST /api/pods — create a new pod |
| `useCreateMeal(podId)` | mutation | POST /api/pods/:podId/meals — register meal + get upload URL |
| `useUploadMealImage()` | mutation | PUT presigned URL — upload bytes to Supabase (no bearer) |
| `usePatchMeal()` | mutation | PATCH /api/meals/:id — mark meal as uploaded |
| `useCompletePod()` | mutation | POST /api/pods/:id/complete — trigger generation |
| `usePodStatus(podId)` | query | GET /api/pods/:podId — polls every 2s while 'generating' |
| `usePodcast(podId, podStatus)` | query | GET /api/pods/:podId/podcast — enabled only when pod.status === 'ready' |

## Performance budget

- Capture screen: ≤ 3 renders on mount (leaf screen budget)
- Pod status screen: ≤ 6 renders on mount (container screen budget)
- Polling: 2 s interval while pod.status === 'generating'; disabled otherwise
- Numbers are enforced by `performance.config.ts` and React.Profiler screenshot tests

## Screens (F4-E2 — in src/app/food/)

| Screen | Route | Description |
|---|---|---|
| `FoodHomeScreen` | `/food` | Start / Continue / View CTAs; reads phase from FoodPodProvider |
| `CaptureScreen` | `/food/capture?podId=X` | Camera + 3-step upload + thumbnail strip + Generate CTA |
| `PodScreen` | `/food/pod/:id` | Generating: 5-stage progress UI (polls 2 s). Ready: expo-av player + synced transcript. Failed: retry button. |

Store: `src/store/food-pod.store.tsx` — React context (`FoodPodProvider` / `useFoodPodStore`)
Holds `currentPodId` and `phase` (`idle | capturing | generating | ready`).

## Closed-loop check

```bash
# Run before every commit that touches src/modules/food/
pnpm test --run src/modules/food
pnpm test --run src/services
pnpm typecheck
pnpm lint
```

All four must exit 0 before committing changes to this module.

## Key decisions

- All `fetch()` calls in `src/services/food.service.ts` only — never in this module
- Bearer token from `EXPO_PUBLIC_DEMO_BEARER_TOKEN` env var (MVP demo token)
  → Phase 2: replace with expo-secure-store + magic link
- React Query for all server state (no Zustand for remote data)
- Presigned URL upload bypasses the API server; no Authorization header on that request
- Pod polling uses `refetchInterval` callback to stop automatically when terminal

## Forbidden

- Calling `fetch()` directly anywhere in this module
- Importing from `src/services/` in screen files — screens use hooks from this module
- Accessing `src/app/food/` from this module (screens own their own route logic)
