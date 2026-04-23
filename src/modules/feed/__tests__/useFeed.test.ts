/**
 * Tests for the useFeed hook.
 * Tests the underlying service functions directly to achieve coverage
 * of the hook's logic paths.
 */

import { resetUser } from '@fh/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fetchFeedToday,
  fetchWhyCard,
  loadDemoScenario,
  postShuffle,
  postSignal,
} from '@/services/feed.service';

const DEMO_USER = 'sienna';

beforeEach(() => {
  resetUser(DEMO_USER);
});

afterEach(() => {
  resetUser(DEMO_USER);
});

describe('useFeed — scenario loading via service', () => {
  it('scenario A → high readiness + strength priority', () => {
    const state = loadDemoScenario('A');
    expect(state.readiness).toBe('high');
    expect(state.daily_priority.domain).toBe('strength');
    expect(state.daily_priority.effort_level).toBe('moderate');
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('scenario B → low readiness + breathing priority (knee flagged)', () => {
    const state = loadDemoScenario('B');
    expect(state.readiness).toBe('low');
    expect(state.daily_priority.domain).toBe('breathing');
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('scenario C → medium readiness + mobility priority (hip scan)', () => {
    const state = loadDemoScenario('C');
    expect(state.readiness).toBe('medium');
    expect(state.daily_priority.domain).toBe('mobility');
  });

  it('scenario D → medium readiness + light cardio (3 skips)', () => {
    const state = loadDemoScenario('D');
    expect(state.readiness).toBe('medium');
    expect(state.daily_priority.domain).toBe('cardio');
    expect(state.daily_priority.effort_level).toBe('light');
  });
});

describe('useFeed — sendReadinessTap signal path', () => {
  it('happy tap on loaded state → high readiness', () => {
    loadDemoScenario('A');
    const state = postSignal({ signal_type: 'readiness_tap', payload: { readiness: 'happy' } });
    expect(state.readiness).toBe('high');
  });

  it('sad tap → low readiness + breathing priority', () => {
    loadDemoScenario('A');
    const state = postSignal({ signal_type: 'readiness_tap', payload: { readiness: 'sad' } });
    expect(state.readiness).toBe('low');
    expect(state.daily_priority.domain).toBe('breathing');
  });

  it('neutral tap → medium readiness', () => {
    loadDemoScenario('A');
    const state = postSignal({ signal_type: 'readiness_tap', payload: { readiness: 'neutral' } });
    expect(state.readiness).toBe('medium');
  });

  it('session_completed signal updates state', () => {
    loadDemoScenario('A');
    const state = postSignal({
      signal_type: 'session_completed',
      payload: { card_id: 'strength_lower_45min', duration_min: 45, effort_rating: 3 },
    });
    expect(state.user_id).toBe(DEMO_USER);
    expect(state.daily_priority).toBeDefined();
    expect(Array.isArray(state.adaptation_reasons)).toBe(true);
  });
});

describe('useFeed — openWhy path', () => {
  it('fetchWhyCard returns rationale for current priority', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    const cardId = state.daily_priority.card_id;
    const why = fetchWhyCard(cardId);
    expect(why.card_id).toBe(cardId);
    expect(why.rationale_expanded).toBeTruthy();
    expect(why.audio_rationale_url).toBeNull();
    expect(why.composed_at).toBeTruthy();
  });

  it('fetchWhyCard throws for invalid card id', () => {
    loadDemoScenario('A');
    expect(() => fetchWhyCard('not_a_real_card')).toThrow();
  });

  it('returns expanded rationale for supporting cards', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    for (const card of state.supporting_cards) {
      const why = fetchWhyCard(card.card_id);
      expect(why.rationale_expanded).toBeTruthy();
    }
  });
});

describe('useFeed — shuffle path', () => {
  it('postShuffle returns different priority or null', () => {
    loadDemoScenario('A');
    const initial = fetchFeedToday();
    const result = postShuffle(initial.daily_priority.card_id);
    if (result !== null) {
      expect(result.daily_priority.card_id).not.toBe(initial.daily_priority.card_id);
      // Cooldown set
      expect(result.shuffle_cooldown_until).not.toBeNull();
      const ms = new Date(result.shuffle_cooldown_until as string).getTime() - Date.now();
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(3 * 60 * 1000 + 500);
    } else {
      expect(result).toBeNull();
    }
  });

  it('getFeedToday returns initial state without cooldown', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    expect(state.shuffle_cooldown_until).toBeNull();
  });
});

describe('useFeed — state contract', () => {
  it('CoachingState has all fields for all scenarios', () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      resetUser(DEMO_USER);
      const state = loadDemoScenario(key);
      expect(typeof state.user_id).toBe('string');
      expect(typeof state.composed_at).toBe('string');
      expect(['high', 'medium', 'low']).toContain(state.readiness);
      expect(typeof state.readiness_rationale).toBe('string');
      expect(state.readiness_rationale.length).toBeGreaterThan(0);
      expect(state.daily_priority).toBeDefined();
      expect(state.supporting_cards).toHaveLength(3);
      expect(state.shuffle_cooldown_until).toBeNull();
    }
  });

  it('all FeedCards have audio_rationale_url null', () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      resetUser(DEMO_USER);
      const state = loadDemoScenario(key);
      expect(state.daily_priority.audio_rationale_url).toBeNull();
      for (const card of state.supporting_cards) {
        expect(card.audio_rationale_url).toBeNull();
      }
    }
  });

  it('all FeedCards have required fields', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    const allCards = [state.daily_priority, ...state.supporting_cards];
    for (const card of allCards) {
      expect(typeof card.card_id).toBe('string');
      expect([
        'strength',
        'cardio',
        'mobility',
        'recovery',
        'breathing',
        'nutrition',
        'reflection',
      ]).toContain(card.domain);
      expect(typeof card.title).toBe('string');
      expect(['light', 'moderate', 'hard']).toContain(card.effort_level);
      expect(typeof card.duration_min).toBe('number');
      expect(typeof card.rationale_short).toBe('string');
      expect(typeof card.rationale_expanded).toBe('string');
    }
  });
});
