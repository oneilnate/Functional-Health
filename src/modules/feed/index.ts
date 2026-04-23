/**
 * feed module — public API surface per AGENTS.md §4 architecture contract.
 *
 * Exports: types, hooks, components (no business logic in screens).
 */

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
