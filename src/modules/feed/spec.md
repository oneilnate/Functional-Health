# feed — Feed Decision Engine

## Purpose

Renders the coaching feed: daily priority card, supporting cards, readiness battery,
smileys signal input, and scenario switcher. Wired to the `@fh/engine` package for
all decision logic. Implements spec §12 (mobile architecture).

## Responsibilities

Owns:
- FeedScreen component (coordinates all feed elements)
- ReadinessBattery component (3 states per spec §12.1)
- DailyPriorityCard component (with "why" button per spec §12.2)
- SupportingCard component (with pairing affordance per spec §12.3)
- WhySheet bottom sheet (expanded rationale per spec §12.2)
- ReadinessSmileys (signal plumbing per spec §12.6)
- RecompositionOverlay (blur animation per spec §12.4)
- ScenarioSwitcher (dev-mode scenario cycling)
- useFeed hook (state management, animation, signal dispatch)

Does NOT own:
- Engine decision logic (owned by `@fh/engine`)
- API calls (services layer via `src/services/feed.service.ts`)
- Navigation (owned by `src/app/`)

## Public API

```typescript
export { DailyPriorityCard } from './components/DailyPriorityCard';
export { FeedScreen } from './components/FeedScreen';
export { ReadinessBattery } from './components/ReadinessBattery';
export { ReadinessSmileys } from './components/ReadinessSmileys';
export { RecompositionOverlay } from './components/RecompositionOverlay';
export { ScenarioSwitcher } from './components/ScenarioSwitcher';
export { SupportingCard } from './components/SupportingCard';
export { WhySheet } from './components/WhySheet';
export type { AnimationPhase, UseFeedResult } from './hooks/useFeed';
export { useFeed } from './hooks/useFeed';
```

## Performance budget

- Renders on mount: ≤ 6 (container screen budget)
- First content visible: < 500 ms after mount
- Recomposition animation: ~800ms total (300ms blur + 500ms settle) per spec §12.4

## Closed-loop check

```bash
pnpm test --run src/modules/feed
pnpm typecheck
pnpm lint
```

## Key decisions

- Decision: engine is imported directly (no HTTP server in v1); service layer wraps it
- Decision: recomposition animation is opacity-based (useNativeDriver: true) for performance
- Decision: shuffle cooldown is session-only, not persisted (spec §12.5)
- Decision: supporting cards have NO "why" button — keeps density low (spec §12.3)
- Decision: audio_rationale_url is always null in v1 (spec §9.4)

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/feed.service.ts`.
- Forbidden: engine imports in screen files — use the useFeed hook.
- Use ScrollView (not FlatList) for the feed — list is short and static.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
