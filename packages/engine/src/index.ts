/**
 * @fh/engine — Feed Decision Engine
 * Public API surface.
 */

// Core engine functions (HTTP-equivalent API)
export { getFeedToday, ingestSignal, shuffleFeed, getWhyCard, loadScenario, resetUser, getUserModel } from './engine.ts';

// Types — everything consumers need to render the feed
export type {
  CoachingState,
  FeedCard,
  Domain,
  EffortLevel,
  Readiness,
  SignalRequest,
  SignalType,
  UserModel,
  ScenarioFixture,
} from './types.ts';

// Scenario fixtures — for tests and scenario switcher
export { ALL_SCENARIOS, scenarioA, scenarioB, scenarioC, scenarioD } from './fixtures/scenarios.ts';
export type { ScenarioKey } from './fixtures/scenarios.ts';

// Sienna base model — for seeding
export { SIENNA_BASE_USER_MODEL, buildScenarioModel } from './user-model.ts';
