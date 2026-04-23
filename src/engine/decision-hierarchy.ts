/**
 * Feed Decision Engine — Four-Layer Decision Hierarchy
 * Layer order (fixed per spec §9.2): safety → feasibility → goal alignment → engagement
 */
import type { CatalogCard, UserModel } from './types';

// Layer 1: Safety veto — silent in v1
export function safetyFilter(cards: CatalogCard[], user: UserModel): CatalogCard[] {
  const flags = [...user.latest_body_state.discomfort_flags, ...user.constraints.discomfort_areas];
  if (flags.length === 0) return cards;
  return cards.filter(
    (c) => !c.discomfort_contraindications.some((contra) => flags.includes(contra)),
  );
}

// Layer 2: Feasibility filter
export function feasibilityFilter(cards: CatalogCard[], user: UserModel): CatalogCard[] {
  return cards.filter((c) => {
    const requiredEquip = c.equipment_required;
    if (requiredEquip.length > 0) {
      const userGear = user.preferences.gear;
      if (!requiredEquip.every((e) => userGear.includes(e))) return false;
    }
    // Evening + hard + long: deprioritize (but don't remove entirely)
    return true;
  });
}

// Layer 3: Goal alignment scorer — weighted by user goals
export function goalAlignmentScore(card: CatalogCard, user: UserModel): number {
  let score = 0;
  for (const goal of user.goals) {
    if (card.goal_tags.includes(goal.tag)) {
      score += goal.weight;
    }
  }

  // Readiness-based domain bonus:
  // Low readiness → boost breathing/recovery domains
  // Medium → neutral
  // High → boost strength/cardio
  const readinessTap = user.latest_situation.readiness;
  const sleep = user.latest_situation.sleep_hours ?? 7;
  const discomfort = user.latest_body_state.discomfort_flags.length;
  const scanFlags = user.latest_body_state.scan_flags.length;
  const skippedStreak = user.recent_behavior.sessions_skipped_streak;

  if (readinessTap === 'sad' || sleep < 6 || discomfort >= 1) {
    // Push breathing and recovery to the top
    if (card.domain === 'breathing') score += 10;
    if (card.domain === 'recovery') score += 8;
    if (card.domain === 'nutrition') score += 1; // nutrition is OK but not priority
    // Penalize high-effort or intensity domains
    if (card.effort_level === 'hard') score -= 15;
    if (card.effort_level === 'moderate') score -= 5;
  } else if (scanFlags > 0) {
    // Post-scan: boost the mobility domain for the scanned area
    if (card.domain === 'mobility') score += 10;
  } else if (skippedStreak >= 3) {
    // 3 misses: boost easy cardio/light activity for reset
    if (card.domain === 'cardio' && card.effort_level === 'light') score += 10;
    if (card.domain === 'recovery' && card.effort_level === 'light') score += 5;
    if (card.effort_level === 'hard') score -= 10;
    if (card.effort_level === 'moderate') score -= 5;
  } else if (readinessTap === 'happy' && sleep >= 6.5 && discomfort === 0) {
    // High readiness: boost strength/cardio
    if (card.domain === 'strength') score += 8;
    if (card.domain === 'cardio') score += 4;
    // Effort boost for high readiness
    if (card.effort_level === 'moderate') score += 3;
  }

  return score;
}

// Layer 4: Engagement re-rank on top half
export function engagementScore(card: CatalogCard, user: UserModel): number {
  let score = 0;
  const b = user.recent_behavior;

  // Penalize same domain if done very recently
  if (b.last_session_domain === card.domain && b.last_session_hours_ago < 24) {
    score -= 2;
  }

  // Slight boost for variety
  if (b.last_session_domain !== card.domain) {
    score += 0.5;
  }

  // Boost if consistent sessions this week
  if (b.sessions_this_week >= 3) {
    score += 0.5;
  }

  const sleep = user.latest_situation.sleep_hours ?? 7;
  if (card.effort_level === 'hard' && sleep < 6) score -= 3;
  if (card.effort_level === 'moderate' && sleep < 5) score -= 1;

  return score;
}

// Diversify supporting cards: no two in the same domain unless forced
export function diversifySupports(
  scored: Array<{ card: CatalogCard; score: number }>,
  priority: CatalogCard,
  count: number,
): CatalogCard[] {
  const usedDomains = new Set<string>([priority.domain]);
  const result: CatalogCard[] = [];

  for (const { card } of scored) {
    if (result.length >= count) break;
    if (!usedDomains.has(card.domain)) {
      usedDomains.add(card.domain);
      result.push(card);
    }
  }

  // Allow domain repeats if needed
  if (result.length < count) {
    for (const { card } of scored) {
      if (result.length >= count) break;
      if (!result.includes(card)) {
        result.push(card);
      }
    }
  }

  return result;
}
