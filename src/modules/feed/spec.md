# Feed Module — Feed Decision Engine

## Purpose

Implements the coaching feed that composes a personalized daily activity recommendation
from a four-layer decision engine (safety → feasibility → goal alignment → engagement).
This module owns all feed UI components, the `useFeed` hook, and re-exports the
`FeedScreen` that replaces the static home screen.

## Responsibilities

Owns:
- `FeedScreen` — main coaching feed with readiness header, priority card, supporting cards, and signal plumbing
- `ReadinessBattery` — three-state battery (high/medium/low) per spec §12.1
- `DailyPriorityCard` — dominant priority card with "why" button per spec §12.2
- `SupportingCard` — supporting activity cards with pairing affordance per spec §12.3
- `WhyBottomSheet` — expanded rationale bottom sheet; audio stub for v1.1
- `ReadinessSmileys` — three-smiley readiness input, fires /signals/ingest per spec §12.6
- `ScenarioSwitcher` — dev-mode tool to cycle through all 4 Sienna scenarios
- `useFeed` hook — wraps feed service calls, manages recomposition state

Does NOT own:
- Engine logic (lives in `src/engine/`)
- API calls (lives in `src/services/feed.service.ts`)
- App navigation (lives in `src/app/index.tsx`)

## Public API

```typescript
export { FeedScreen } from './components/feed-screen';
export { ReadinessBattery } from './components/readiness-battery';
export { DailyPriorityCard } from './components/daily-priority-card';
export { SupportingCard } from './components/supporting-card';
export { WhyBottomSheet } from './components/why-bottom-sheet';
export { ReadinessSmileys } from './components/readiness-smileys';
export { ScenarioSwitcher } from './components/scenario-switcher';
export { useFeed } from './hooks/use-feed';
```

## Performance budget

- Renders on mount: ≤ 6 (container screen budget)
- First priority card visible: < 500ms after mount
- Recomposition animation: ~800ms total (300ms blur + 500ms settle) per spec §12.4

## Key decisions

- Engine runs in-process (no HTTP server in Expo scaffold)
- Shuffle cooldown: 3 minutes, session-only per spec §12.5
- Supporting cards: no "why" button (v1) — density kept low
- Audio rationale: null in v1, stub visible in WhyBottomSheet (v1.1)
- Safety vetoes: silent in v1, no UI surfacing per spec §16.1

## Agent instructions

- Read this file before making any changes to this module.
- Run `pnpm exec vitest run src/engine/engine.test.ts` to verify engine tests.
- Run `pnpm typecheck && pnpm lint` before committing.
- Forbidden: calling fetch directly — use `src/services/feed.service.ts`.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
