/**
 * DecisionHierarchy — four-layer decision function per spec §9.2.
 *
 * Layer 1: Safety veto — removes contraindicated cards (silent in v1)
 * Layer 2: Feasibility filter — removes equipment/time mismatches
 * Layer 3: Goal alignment scorer — ranks by goal weights + readiness + scan context
 * Layer 4: Engagement optimizer — nudges top half with engagement signal (tiebreaker)
 */

import { allCards } from './catalog/loader.ts';
import type { CatalogCard, UserModel } from './types.ts';

/** Actual body discomfort — excludes scan identifiers */
function actualDiscomfortAreas(user: UserModel): string[] {
  return user.constraints_json.discomfort_areas.filter((a) => !a.includes('scan'));
}

/** Compute effective readiness for scoring purposes */
function effectiveReadiness(user: UserModel): 'high' | 'medium' | 'low' {
  const { latest_situation_json, recent_behavior_json } = user;
  const actualDiscomfort = actualDiscomfortAreas(user);

  const hasSevereDiscomfort =
    actualDiscomfort.length > 0 || recent_behavior_json.avg_sleep_hours_7d < 5.5;
  const hasMinorChallenges =
    recent_behavior_json.avg_sleep_hours_7d < 6.5 ||
    recent_behavior_json.stress_level === 'high' ||
    recent_behavior_json.sessions_skipped_7d > 2;

  if (latest_situation_json.readiness === 'sad' || hasSevereDiscomfort) return 'low';
  if (latest_situation_json.readiness === 'happy' && !hasMinorChallenges) return 'high';
  return 'medium';
}

/**
 * Readiness-aware goal score.
 * Scan context and skips produce strong domain overrides.
 * This is the PRIMARY ranking signal.
 */
function goalScore(card: CatalogCard, user: UserModel): number {
  const { recent_behavior_json, latest_body_state_json } = user;
  const skips = recent_behavior_json.sessions_skipped_7d;
  const hasScan = latest_body_state_json.last_scan_result !== null;
  const scanType = latest_body_state_json.scan_type;
  const readiness = effectiveReadiness(user);

  let score = 0;

  // Base goal alignment
  for (const goal of user.goals_json) {
    if (card.domain === goal.goal) {
      score += goal.weight * 10;
    }
  }

  // Readiness overrides
  if (readiness === 'low') {
    if (card.domain === 'breathing') score += 25;
    if (card.domain === 'recovery') score += 12;
    if (card.effort_level === 'hard') score -= 20;
    if (card.effort_level === 'moderate') score -= 12;
    if (card.duration_min > 20) score -= 5;
    if (card.domain === 'strength') score -= 8;
  } else if (readiness === 'medium') {
    if (card.effort_level === 'hard') score -= 3;
  } else {
    if ((card.domain === 'strength' || card.domain === 'cardio') && card.effort_level !== 'light') {
      score += 2;
    }
  }

  // Scan context — strong domain override
  if (hasScan && scanType) {
    if (scanType === 'hip_mobility' && card.domain === 'mobility') {
      if (card.card_id.includes('hip')) score += 25;
      score += 15;
    } else if (scanType.includes('mobility') && card.domain === 'mobility') {
      score += 15;
    }
    // Penalize non-scan-domain when there's a fresh scan
    if (scanType === 'hip_mobility' && card.domain !== 'mobility' && card.domain !== 'breathing') {
      score -= 3;
    }
  }

  // 3+ skips → light cardio re-entry
  if (skips >= 3) {
    if (card.domain === 'cardio' && card.effort_level === 'light') score += 18;
    if (card.effort_level === 'hard') score -= 12;
    if (card.domain === 'strength' && card.effort_level !== 'light') score -= 10;
    if (card.domain === 'reflection') score += 5;
  }

  // Domain diversity — avoid repeating last session
  if (card.domain !== domainOfLastSession(user)) {
    score += 0.5;
  }

  return score;
}

/**
 * Engagement score — tiebreaker only.
 * Low multiplier so it can't override large goal score gaps.
 */
function engagementScore(card: CatalogCard, user: UserModel): number {
  const { domains_touched_7d, sessions_completed_7d, sessions_skipped_7d } =
    user.recent_behavior_json;
  let score = 0;

  if (domains_touched_7d.includes(card.domain)) score += 1;

  const total = sessions_completed_7d + sessions_skipped_7d;
  if (total > 0) {
    score += (sessions_completed_7d / total) * 1.5;
  }

  if (sessions_skipped_7d > 1 && card.duration_min <= 20) score += 0.5;

  return score;
}

function domainOfLastSession(user: UserModel): string | null {
  const lastId = user.recent_behavior_json.last_session_card_id;
  if (!lastId) return null;
  return lastId.split('_')[0] ?? null;
}

/** Check if a card conflicts with actual body discomfort flags */
function conflictsWithDiscomfort(card: CatalogCard, user: UserModel): boolean {
  const bodyFlags = user.latest_body_state_json.discomfort_flags;
  return bodyFlags.some((flag) =>
    card.discomfort_contraindications_json.some((contra) =>
      flag.toLowerCase().includes(contra.toLowerCase()),
    ),
  );
}

/** Check if user has required equipment */
function hasEquipment(card: CatalogCard, gear: string[]): boolean {
  const gearSet = new Set(gear);
  return card.equipment_required_json.every((eq) => gearSet.has(eq));
}

/** Check if card duration fits the user's time context */
function fitsTimeContext(card: CatalogCard, user: UserModel): boolean {
  const ctx = user.latest_situation_json.time_context;
  if (
    (ctx === 'evening' || ctx === 'night') &&
    card.effort_level === 'hard' &&
    card.duration_min > 40
  ) {
    return false;
  }
  return true;
}

/** Diversify supports: no two in same domain unless pool forces it */
function diversify(candidates: CatalogCard[], priority: CatalogCard, count: number): CatalogCard[] {
  const result: CatalogCard[] = [];
  const usedDomains = new Set<string>([priority.domain]);

  for (const card of candidates) {
    if (result.length >= count) break;
    if (!usedDomains.has(card.domain)) {
      result.push(card);
      usedDomains.add(card.domain);
    }
  }

  for (const card of candidates) {
    if (result.length >= count) break;
    if (!result.includes(card)) {
      result.push(card);
    }
  }

  return result.slice(0, count);
}

export interface HierarchyResult {
  priority: CatalogCard;
  supports: CatalogCard[];
  safetyVetoed: boolean;
}

function fallbackComposition(): HierarchyResult {
  const breathing = allCards().find((c) => c.domain === 'breathing');
  const reflection = allCards().find((c) => c.domain === 'reflection');
  const nutrition = allCards().find((c) => c.domain === 'nutrition');
  const mobility = allCards().find((c) => c.domain === 'mobility');

  const fallback = breathing ?? allCards()[0];
  if (!fallback) throw new Error('Empty card catalog');

  return {
    priority: fallback,
    supports: [reflection ?? fallback, nutrition ?? fallback, mobility ?? fallback].slice(
      0,
      3,
    ) as CatalogCard[],
    safetyVetoed: true,
  };
}

/** Run the four-layer decision hierarchy — spec §9.2 + Appendix A.2 */
export function runDecisionHierarchy(
  user: UserModel,
  excludeCardIds: string[] = [],
): HierarchyResult {
  const all = allCards();

  // Layer 1: Safety veto (silent in v1)
  const safe = all.filter((c) => !conflictsWithDiscomfort(c, user));

  // Layer 2: Feasibility filter
  const feasible = safe.filter(
    (c) =>
      hasEquipment(c, user.preferences_json.gear) &&
      fitsTimeContext(c, user) &&
      !excludeCardIds.includes(c.card_id),
  );

  if (feasible.length === 0) {
    return fallbackComposition();
  }

  // Layer 3: Goal alignment scorer
  const scored = feasible
    .map((card) => ({ card, goalScore: goalScore(card, user) }))
    .sort((a, b) => b.goalScore - a.goalScore);

  // Layer 4: Combined sort using goal + engagement tiebreaker
  // Engagement is a nudge (max ~3 points), not an override of goal score differences
  const combined = scored.map(({ card, goalScore: gs }) => ({
    card,
    totalScore: gs + engagementScore(card, user),
  }));
  combined.sort((a, b) => b.totalScore - a.totalScore);

  const ranked = combined.map((c) => c.card);

  const priority = ranked[0];
  if (!priority) return fallbackComposition();

  const supportCandidates = ranked.slice(1);
  const supports = diversify(supportCandidates, priority, 3);

  return { priority, supports, safetyVetoed: false };
}
