/**
 * Feed service — wraps the engine API per AGENTS.md service layer contract.
 * This is the only place engine functions are called from the mobile side.
 *
 * In v1, the engine is called directly (no HTTP server).
 * The service interface matches the HTTP API spec so a Fastify wrapper
 * can be dropped in later without changing callers.
 */
import {
  type CoachingState,
  getWhyCard as engineGetWhyCard,
  loadScenario as engineLoadScenario,
  getFeedToday,
  ingestSignal,
  type ScenarioKey,
  type SignalRequest,
  shuffleFeed,
} from '@fh/engine';

const DEMO_USER_ID = 'sienna';

/** GET /feed/today — returns the composed feed for the current user */
export function fetchFeedToday(): CoachingState {
  return getFeedToday(DEMO_USER_ID);
}

/** POST /signals/ingest — fires a signal and returns the refreshed state */
export function postSignal(signal: SignalRequest): CoachingState {
  return ingestSignal(DEMO_USER_ID, signal);
}

/** POST /feed/shuffle — returns a fresh composition (or null if variety exhausted) */
export function postShuffle(currentPriorityId: string): CoachingState | null {
  return shuffleFeed(DEMO_USER_ID, currentPriorityId);
}

/** GET /feed/why/:cardId — returns expanded rationale for a card */
export function fetchWhyCard(cardId: string): {
  card_id: string;
  rationale_expanded: string;
  audio_rationale_url: null;
  composed_at: string;
} {
  return engineGetWhyCard(DEMO_USER_ID, cardId);
}

/** Load a demo scenario — dev mode only */
export function loadDemoScenario(key: ScenarioKey): CoachingState {
  return engineLoadScenario(DEMO_USER_ID, key);
}
