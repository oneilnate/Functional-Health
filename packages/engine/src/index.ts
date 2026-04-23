/**
 * @fh/engine — Feed Decision Engine
 * Public API surface.
 */

// Core engine functions (HTTP-equivalent API)
export {
  getFeedToday,
  getUserModel,
  getWhyCard,
  ingestSignal,
  loadScenario,
  resetUser,
  shuffleFeed,
} from './engine.ts';
export type { ScenarioKey } from './fixtures/scenarios.ts';

// Scenario fixtures — for tests and scenario switcher
export { ALL_SCENARIOS, scenarioA, scenarioB, scenarioC, scenarioD } from './fixtures/scenarios.ts';
// Types — everything consumers need to render the feed
export type {
  CoachingState,
  Domain,
  EffortLevel,
  FeedCard,
  Readiness,
  ScenarioFixture,
  SignalRequest,
  SignalType,
  UserModel,
} from './types.ts';

// Sienna base model — for seeding
export { buildScenarioModel, SIENNA_BASE_USER_MODEL } from './user-model.ts';
