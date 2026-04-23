# feed

## Purpose

The Feed Decision Engine module. Implements the coaching brain that composes
the daily coaching feed: decides the daily priority, arranges supporting cards,
sets readiness, and carries a rationale the user can ask about.

**Spec reference:** `art_XZYLOOKi` — Feed Decision Engine — Backend & Mobile Design Spec.

## Responsibilities

Owns:
- `useFeed` hook — all feed state management, animation, signal plumbing
- `ReadinessBattery` — 3-state readiness indicator (high/medium/low)
- `DailyPriorityCard` — priority card with why button, shuffle button
- `SupportingCard` — supporting cards with optional pairing affordance
- `WhySheet` — bottom sheet with expanded rationale
- `ReadinessSmileys` — signal input for readiness taps → `/signals/ingest`
- `ScenarioSwitcher` — dev-mode scenario switcher for the 4 Sienna scenarios
- `RecompositionOverlay` — recomposition animation overlay (~800ms total)
- `FeedScreen` — the full feed screen layout

Does NOT own:
- Engine logic (`packages/engine/@fh/engine`)
- API calls (all via `src/services/feed.service.ts`)
- Navigation (belongs in `src/app/`)
- FoodPod or Mood+AI Chat surfaces (sibling specs)

## Public API

```typescript
// Hook
export { useFeed } from './hooks/useFeed';

// Components
export { ReadinessBattery, DailyPriorityCard, SupportingCard } from './components/...';
export { WhySheet, ReadinessSmileys, ScenarioSwitcher, RecompositionOverlay } from './components/...';
export { FeedScreen } from './components/FeedScreen';
```

## Performance budget

- Renders on mount: ≤ 6 (container screen budget — feed is a scroll container)
- Recomposition animation: ~800ms total (300ms blur → 500ms settle)
- Signal ingest: synchronous (engine is pure function, no network call in v1)

## Closed-loop check

```bash
pnpm test --run src/modules/feed
pnpm typecheck
pnpm lint
```

## Key decisions

- Engine is called directly (not via HTTP) in v1 — the service layer mirrors the HTTP API shape
- Animation uses `useNativeDriver: true` for opacity (blur effect approximated)
- 4 canonical Sienna scenarios switchable via ScenarioSwitcher (dev mode, always visible for demo)
- WhySheet uses React Native Modal with `animationType="slide"` for both native and web
- Shuffle cooldown tracked in `useFeed` (session-only, not persisted per spec)
- Audio rationale is v1.1 stub (`audio_rationale_url: null` always)
