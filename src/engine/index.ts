/**
 * Feed Decision Engine — Public API
 * Pure TypeScript engine; no HTTP server in this Expo-only scaffold.
 * The service layer (src/services/feed.service.ts) calls these directly.
 */
export { applySignal, compose, getWhyRationale, shuffle } from './compose';
export { computeReadiness, renderReadinessRationale } from './readiness';
export type {
  CatalogCard,
  CoachingState,
  Domain,
  EffortLevel,
  EngineInput,
  FeedCard,
  Readiness,
  ScenarioFixture,
  SignalEvent,
  SignalType,
  UserModel,
} from './types';
