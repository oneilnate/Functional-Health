/**
 * FeedComposer — picks priority + 3 supporting cards, materializes FeedCards.
 * Entry point for the engine's output.
 */

import { findCrossModality } from './cross-modality.ts';
import { runDecisionHierarchy } from './decision-hierarchy.ts';
import { renderExpanded, renderShort } from './rationale.ts';
import { computeReadiness } from './readiness.ts';
import type { CatalogCard, CoachingState, FeedCard, UserModel } from './types.ts';

function materializeCard(
  card: CatalogCard,
  user: UserModel,
  linksToCardId: string | null,
): FeedCard {
  return {
    card_id: card.card_id,
    domain: card.domain,
    title: card.title,
    effort_level: card.effort_level,
    duration_min: card.duration_min,
    rationale_short: renderShort(card, user),
    rationale_expanded: renderExpanded(card, user),
    audio_rationale_url: null, // v1.1
    links_to_card_id: linksToCardId,
  };
}

function recentSignalSummary(user: UserModel): string[] {
  const reasons: string[] = [];
  const areas = user.constraints_json.discomfort_areas;
  const sleep = user.recent_behavior_json.avg_sleep_hours_7d;
  const readiness = user.latest_situation_json.readiness;
  const hasScan = user.latest_body_state_json.last_scan_result !== null;
  const skips = user.recent_behavior_json.sessions_skipped_7d;

  if (readiness === 'happy') reasons.push('readiness tap: feeling good');
  if (readiness === 'sad') reasons.push('readiness tap: low energy');
  if (areas.length > 0) reasons.push(`discomfort flagged: ${areas.join(', ')}`);
  if (sleep < 6.5) reasons.push(`sleep averaging ${sleep.toFixed(0)}h`);
  if (hasScan) reasons.push(`scan updated: ${user.latest_body_state_json.scan_type ?? 'mobility'}`);
  if (skips >= 3) reasons.push(`${skips} sessions skipped this week`);

  return reasons;
}

/** Core composition function — pure function over user model */
export function compose(
  user: UserModel,
  excludeCardIds: string[] = [],
  shuffleCooldownUntil: string | null = null,
): CoachingState {
  const { priority, supports } = runDecisionHierarchy(user, excludeCardIds);

  const crossModality = findCrossModality(priority, supports);

  const priorityCard = materializeCard(priority, user, crossModality.priorityLinksTo);

  const supportCards = supports.map((s) =>
    materializeCard(s, user, crossModality.supportLinksTo.get(s.card_id) ?? null),
  );

  const { readiness, rationale: readinessRationale } = computeReadiness(user);

  return {
    user_id: user.user_id,
    composed_at: new Date().toISOString(),
    readiness,
    readiness_rationale: readinessRationale,
    daily_priority: priorityCard,
    supporting_cards: supportCards,
    cross_modality_note: crossModality.note,
    adaptation_reasons: recentSignalSummary(user),
    shuffle_cooldown_until: shuffleCooldownUntil,
  };
}

/** Compose a shuffle: same posture, different card picks */
export function composeShuffle(user: UserModel, currentPriorityId: string): CoachingState | null {
  // Exclude current priority — forces a different top pick
  const result = runDecisionHierarchy(user, [currentPriorityId]);

  // If the engine returned the same card (forced by small pool), signal no-op
  if (result.priority.card_id === currentPriorityId) {
    return null;
  }

  const cooldownUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  return compose(user, [currentPriorityId], cooldownUntil);
}
