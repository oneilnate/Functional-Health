/**
 * @fh/engine — Feed Decision Engine public API
 *
 * Exports all types, fixtures, and engine functions needed by consumers.
 */

// Catalog
export { allCards, getCard } from './catalog/loader.ts';
export { compose, composeShuffle } from './composer.ts';
export { runDecisionHierarchy } from './decision-hierarchy.ts';
// Engine API (four endpoints)
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
// Scenario fixtures (for dev mode and tests)
export { ALL_SCENARIOS, scenarioA, scenarioB, scenarioC, scenarioD } from './fixtures/scenarios.ts';
// Internals (for testing)
export { computeReadiness } from './readiness.ts';
// Types
export type {
  CatalogCard,
  CoachingState,
  Domain,
  EffortLevel,
  FeedCard,
  RationaleTemplates,
  Readiness,
  ScenarioFixture,
  SignalEvent,
  SignalRequest,
  SignalType,
  UserModel,
} from './types.ts';
