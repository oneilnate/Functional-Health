/**
 * Engine API — the four HTTP-equivalent functions.
 *
 * In v1 these are pure TypeScript functions called from:
 * - MSW handlers (test environment)
 * - Direct import from mobile (production)
 *
 * Shape is kept identical to the HTTP API spec so a Fastify wrapper can be
 * dropped in later without changes to callers.
 */

import { getCard } from './catalog/loader.ts';
import { compose, composeShuffle } from './composer.ts';
import { ALL_SCENARIOS, type ScenarioKey } from './fixtures/scenarios.ts';
import { renderExpanded } from './rationale.ts';
import type { CoachingState, SignalRequest, UserModel } from './types.ts';
import { applySignalToModel, buildScenarioModel, SIENNA_BASE_USER_MODEL } from './user-model.ts';

/**
 * In-memory store for the demo — no persistence in v1.
 * In production this would be Postgres (user_model + coaching_state_snapshot).
 */
const userModels = new Map<string, UserModel>();
const shuffleCooldowns = new Map<string, string>(); // userId → ISO timestamp

function getOrCreateUserModel(userId: string): UserModel {
  if (!userModels.has(userId)) {
    const base: UserModel = {
      ...SIENNA_BASE_USER_MODEL,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    userModels.set(userId, base);
  }
  return userModels.get(userId) as UserModel;
}

/**
 * GET /feed/today
 * Returns the composed CoachingState for the given user.
 */
export function getFeedToday(userId: string): CoachingState {
  const user = getOrCreateUserModel(userId);
  const cooldown = shuffleCooldowns.get(userId) ?? null;
  return compose(user, [], cooldown);
}

/**
 * POST /signals/ingest
 * Accepts a signal, updates the user model, returns refreshed CoachingState.
 */
export function ingestSignal(userId: string, signal: SignalRequest): CoachingState {
  const user = getOrCreateUserModel(userId);
  const updated = applySignalToModel(user, { ...signal, occurred_at: new Date().toISOString() });
  userModels.set(userId, updated);
  const cooldown = shuffleCooldowns.get(userId) ?? null;
  return compose(updated, [], cooldown);
}

/**
 * POST /feed/shuffle
 * Returns a fresh composition within the same coaching posture.
 * Returns null if no variety is available.
 */
export function shuffleFeed(userId: string, currentPriorityId: string): CoachingState | null {
  const user = getOrCreateUserModel(userId);
  const result = composeShuffle(user, currentPriorityId);
  if (!result) return null;

  // Store the cooldown
  shuffleCooldowns.set(userId, result.shuffle_cooldown_until ?? '');
  return result;
}

/**
 * GET /feed/why/:cardId
 * Returns the expanded rationale for a given card.
 */
export function getWhyCard(
  userId: string,
  cardId: string,
): {
  card_id: string;
  rationale_expanded: string;
  audio_rationale_url: null;
  composed_at: string;
} {
  const user = getOrCreateUserModel(userId);
  const card = getCard(cardId);
  return {
    card_id: cardId,
    rationale_expanded: renderExpanded(card, user),
    audio_rationale_url: null,
    composed_at: new Date().toISOString(),
  };
}

/**
 * Load a scenario seed — used by the dev scenario switcher.
 * Seeds the user model with the fixture data and returns the composed state.
 */
export function loadScenario(userId: string, scenarioKey: ScenarioKey): CoachingState {
  const fixture = ALL_SCENARIOS[scenarioKey];
  const model = buildScenarioModel(
    SIENNA_BASE_USER_MODEL,
    fixture.user_model_overrides,
    fixture.seed_signals,
  );
  model.user_id = userId;
  userModels.set(userId, model);
  shuffleCooldowns.delete(userId); // reset cooldown on scenario switch
  return compose(model, [], null);
}

/**
 * Reset user model to base — for testing.
 */
export function resetUser(userId: string): void {
  userModels.delete(userId);
  shuffleCooldowns.delete(userId);
}

/**
 * Get current user model — for testing/inspection.
 */
export function getUserModel(userId: string): UserModel {
  return getOrCreateUserModel(userId);
}
