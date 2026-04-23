/**
 * Feed Decision Engine — Main Compose Function
 * Pure function: given user model + signals, returns CoachingState.
 * Four-layer hierarchy: safety → feasibility → goal alignment → engagement.
 */
import catalogData from './card-catalog.json';
import {
  diversifySupports,
  engagementScore,
  feasibilityFilter,
  goalAlignmentScore,
  safetyFilter,
} from './decision-hierarchy';
import { findCrossModalityNote, findLinkedCardId, renderExpanded, renderShort } from './rationale';
import { computeReadiness, renderReadinessRationale } from './readiness';
import type {
  CatalogCard,
  CoachingState,
  DiscomfortLoggedPayload,
  Domain,
  FeedCard,
  ReadinessTapPayload,
  ScanUpdatedPayload,
  SessionCompletedPayload,
  SessionSkippedPayload,
  SignalEvent,
  UserModel,
} from './types';

const CATALOG: CatalogCard[] = catalogData as CatalogCard[];

function materializeCard(
  catalog: CatalogCard,
  user: UserModel,
  linksToCardId: string | null,
): FeedCard {
  const ctx = { user, card: catalog, now: new Date().toISOString() };
  return {
    card_id: catalog.card_id,
    domain: catalog.domain,
    title: catalog.title,
    effort_level: catalog.effort_level,
    duration_min: catalog.duration_min,
    rationale_short: renderShort(ctx),
    rationale_expanded: renderExpanded(ctx),
    audio_rationale_url: null,
    links_to_card_id: linksToCardId,
  };
}

function fallbackComposition(user: UserModel, now: string): CoachingState {
  const readiness = computeReadiness(user);
  const readiness_rationale = renderReadinessRationale(user, readiness);
  const fallbackCatalog = CATALOG.find((c) => c.card_id === 'breathing_guided_10min')!;
  const priority = materializeCard(fallbackCatalog, user, null);
  return {
    user_id: user.user_id,
    composed_at: now,
    readiness,
    readiness_rationale,
    daily_priority: priority,
    supporting_cards: [],
    cross_modality_note: null,
    adaptation_reasons: ['Catalog too thin after safety and feasibility filters.'],
    shuffle_cooldown_until: null,
  };
}

function recentSignalSummary(user: UserModel): string[] {
  const reasons: string[] = [];
  const tap = user.latest_situation.readiness;
  if (tap === 'sad') reasons.push('Low readiness tap');
  if (tap === 'happy') reasons.push('High readiness tap');
  if (user.latest_body_state.discomfort_flags.length > 0) {
    reasons.push(`Discomfort flagged: ${user.latest_body_state.discomfort_flags.join(', ')}`);
  }
  if (user.latest_body_state.scan_flags.length > 0) {
    reasons.push(`Scan flags: ${user.latest_body_state.scan_flags.join(', ')}`);
  }
  if (user.recent_behavior.sessions_skipped_streak >= 3) {
    reasons.push(`${user.recent_behavior.sessions_skipped_streak} sessions skipped recently`);
  }
  return reasons.length > 0 ? reasons : ['App open — standard composition'];
}

export function compose(user: UserModel, now: string): CoachingState {
  const readiness = computeReadiness(user);
  const readiness_rationale = renderReadinessRationale(user, readiness);

  // Layer 1: Safety veto
  const safe = safetyFilter(CATALOG, user);

  // Layer 2: Feasibility filter
  const feasible = feasibilityFilter(safe, user);

  if (feasible.length < 2) {
    return fallbackComposition(user, now);
  }

  // Layer 3: Goal alignment score
  const scored = feasible.map((c) => ({ card: c, goalScore: goalAlignmentScore(c, user) }));
  scored.sort((a, b) => b.goalScore - a.goalScore);

  // Layer 4: Engagement re-rank on top half
  // Combine goal score + engagement score to preserve goal-alignment ordering
  // Engagement is a tiebreaker / modifier, not a full override
  const topHalf = scored.slice(0, Math.ceil(scored.length / 2));
  const combined = topHalf.map((item) => ({
    card: item.card,
    score: item.goalScore + engagementScore(item.card, user),
  }));
  combined.sort((a, b) => b.score - a.score);

  // Bottom half sorted by goal score only
  const bottomHalf = scored.slice(Math.ceil(scored.length / 2)).map((item) => ({
    card: item.card,
    score: item.goalScore,
  }));

  const reranked = [...combined, ...bottomHalf];

  const priority = reranked[0]?.card;
  if (!priority) return fallbackComposition(user, now);

  const remainingScored = reranked.slice(1);
  const supports = diversifySupports(remainingScored, priority, 3);

  const crossModalityLinkedId = findLinkedCardId(priority, supports);
  const cross_modality_note = findCrossModalityNote(priority, supports);

  const priorityFeedCard = materializeCard(priority, user, crossModalityLinkedId);

  const supportFeedCards = supports.map((c) => {
    const linksTo = c.cross_modality_domains?.includes(priority.domain as Domain)
      ? priority.card_id
      : null;
    return materializeCard(c, user, linksTo);
  });

  return {
    user_id: user.user_id,
    composed_at: now,
    readiness,
    readiness_rationale,
    daily_priority: priorityFeedCard,
    supporting_cards: supportFeedCards,
    cross_modality_note,
    adaptation_reasons: recentSignalSummary(user),
    shuffle_cooldown_until: null,
  };
}

export function applySignal(user: UserModel, signal: SignalEvent): UserModel {
  const updated: UserModel = JSON.parse(JSON.stringify(user)) as UserModel;

  if (signal.signal_type === 'readiness_tap') {
    const p = signal.payload as ReadinessTapPayload;
    updated.latest_situation.readiness = p.readiness;
  } else if (signal.signal_type === 'mood_tap') {
    // Legacy — no-op in v1
  } else if (signal.signal_type === 'session_completed') {
    const p = signal.payload as SessionCompletedPayload;
    updated.recent_behavior.sessions_this_week += 1;
    updated.recent_behavior.last_session_hours_ago = 0;
    updated.recent_behavior.sessions_skipped_streak = 0;
    const card = CATALOG.find((c) => c.card_id === p.card_id);
    if (card) updated.recent_behavior.last_session_domain = card.domain;
  } else if (signal.signal_type === 'session_skipped') {
    updated.recent_behavior.sessions_skipped_streak += 1;
  } else if (signal.signal_type === 'scan_updated') {
    const p = signal.payload as ScanUpdatedPayload;
    updated.latest_body_state.scan_flags = (p.flags ?? []) as string[];
  } else if (signal.signal_type === 'discomfort_logged') {
    const p = signal.payload as DiscomfortLoggedPayload;
    if (!updated.latest_body_state.discomfort_flags.includes(p.area)) {
      updated.latest_body_state.discomfort_flags.push(p.area);
    }
    if (!updated.constraints.discomfort_areas.includes(p.area)) {
      updated.constraints.discomfort_areas.push(p.area);
    }
  }

  return updated;
}

export function shuffle(
  user: UserModel,
  currentPriorityCardId: string,
  now: string,
): CoachingState {
  const safe = safetyFilter(CATALOG, user);
  const feasible = feasibilityFilter(safe, user);
  const pool = feasible.filter((c) => c.card_id !== currentPriorityCardId);

  if (pool.length < 4) {
    const result = compose(user, now);
    return { ...result, shuffle_cooldown_until: null };
  }

  const currentCard = CATALOG.find((c) => c.card_id === currentPriorityCardId);
  const currentDomain = currentCard?.domain;

  const scored = pool.map((c) => {
    const goalScore = goalAlignmentScore(c, user);
    const engScore = engagementScore(c, user);
    const varietyBias = c.domain === currentDomain ? -5 : 0;
    return { card: c, score: goalScore + engScore + varietyBias };
  });
  scored.sort((a, b) => b.score - a.score);

  const priority = scored[0]?.card;
  if (!priority) return compose(user, now);

  const supports = diversifySupports(scored.slice(1), priority, 3);
  const crossModalityLinkedId = findLinkedCardId(priority, supports);
  const cross_modality_note = findCrossModalityNote(priority, supports);

  const readiness = computeReadiness(user);
  const readiness_rationale = renderReadinessRationale(user, readiness);

  const cooldownUntil = new Date(new Date(now).getTime() + 3 * 60 * 1000).toISOString();

  const priorityFeedCard = materializeCard(priority, user, crossModalityLinkedId);
  const supportFeedCards = supports.map((c) => {
    const linksTo = c.cross_modality_domains?.includes(priority.domain as Domain)
      ? priority.card_id
      : null;
    return materializeCard(c, user, linksTo);
  });

  return {
    user_id: user.user_id,
    composed_at: now,
    readiness,
    readiness_rationale,
    daily_priority: priorityFeedCard,
    supporting_cards: supportFeedCards,
    cross_modality_note,
    adaptation_reasons: ['Shuffle — variety requested by user'],
    shuffle_cooldown_until: cooldownUntil,
  };
}

export function getWhyRationale(
  cardId: string,
  user: UserModel,
  now: string,
): { card_id: string; rationale_expanded: string; audio_rationale_url: null; composed_at: string } {
  const card = CATALOG.find((c) => c.card_id === cardId);
  if (!card) {
    return {
      card_id: cardId,
      rationale_expanded: 'Card not found.',
      audio_rationale_url: null,
      composed_at: now,
    };
  }
  const ctx = { user, card, now };
  return {
    card_id: cardId,
    rationale_expanded: renderExpanded(ctx),
    audio_rationale_url: null,
    composed_at: now,
  };
}
