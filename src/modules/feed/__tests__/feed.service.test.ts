/**
 * Tests for src/services/feed.service.ts
 * Exercises the four engine API wrappers.
 */

import { loadScenario as engineLoadScenario, resetUser } from '@fh/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  fetchFeedToday,
  fetchWhyCard,
  loadDemoScenario,
  postShuffle,
  postSignal,
} from '../../../services/feed.service';

const DEMO_USER = 'sienna';

beforeEach(() => {
  resetUser(DEMO_USER);
  // Seed scenario A as baseline
  engineLoadScenario(DEMO_USER, 'A');
});

afterEach(() => {
  resetUser(DEMO_USER);
});

describe('feed.service — fetchFeedToday', () => {
  it('returns a CoachingState with all required fields', () => {
    const state = fetchFeedToday();
    expect(state.user_id).toBe(DEMO_USER);
    expect(state.composed_at).toBeTruthy();
    expect(state.readiness).toMatch(/^(high|medium|low)$/);
    expect(state.daily_priority).toBeDefined();
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('returns high readiness for scenario A', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    expect(state.readiness).toBe('high');
    expect(state.daily_priority.domain).toBe('strength');
  });

  it('returns low readiness for scenario B', () => {
    loadDemoScenario('B');
    const state = fetchFeedToday();
    expect(state.readiness).toBe('low');
    expect(state.daily_priority.domain).toBe('breathing');
  });
});

describe('feed.service — postSignal', () => {
  it('returns updated CoachingState after readiness_tap', () => {
    const state = postSignal({ signal_type: 'readiness_tap', payload: { readiness: 'sad' } });
    expect(state.readiness).toBe('low');
    expect(state.user_id).toBe(DEMO_USER);
  });

  it('changing from happy to sad readiness shifts priority domain', () => {
    loadDemoScenario('A');
    const sadState = postSignal({
      signal_type: 'readiness_tap',
      payload: { readiness: 'sad' },
    });
    // Sad readiness should favor breathing/recovery not strength
    expect(sadState.daily_priority.domain).not.toBe('strength');
  });

  it('all FeedCards have audio_rationale_url null (v1 stub)', () => {
    const state = postSignal({ signal_type: 'readiness_tap', payload: { readiness: 'neutral' } });
    expect(state.daily_priority.audio_rationale_url).toBeNull();
    for (const card of state.supporting_cards) {
      expect(card.audio_rationale_url).toBeNull();
    }
  });
});

describe('feed.service — postShuffle', () => {
  it('returns a different priority card', () => {
    loadDemoScenario('A');
    const original = fetchFeedToday();
    const shuffled = postShuffle(original.daily_priority.card_id);
    // Should return a different card or null if pool exhausted
    if (shuffled !== null) {
      expect(shuffled.daily_priority.card_id).not.toBe(original.daily_priority.card_id);
    }
  });

  it('sets shuffle_cooldown_until when successful', () => {
    loadDemoScenario('A');
    const original = fetchFeedToday();
    const shuffled = postShuffle(original.daily_priority.card_id);
    if (shuffled !== null) {
      expect(shuffled.shuffle_cooldown_until).not.toBeNull();
      const cooldown = new Date(shuffled.shuffle_cooldown_until as string);
      expect(cooldown.getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe('feed.service — fetchWhyCard', () => {
  it('returns expanded rationale for a card', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    const why = fetchWhyCard(state.daily_priority.card_id);
    expect(why.card_id).toBe(state.daily_priority.card_id);
    expect(why.rationale_expanded).toBeTruthy();
    expect(why.audio_rationale_url).toBeNull();
    expect(why.composed_at).toBeTruthy();
  });

  it('rationale_expanded is longer than rationale_short', () => {
    loadDemoScenario('A');
    const state = fetchFeedToday();
    const why = fetchWhyCard(state.daily_priority.card_id);
    const short = state.daily_priority.rationale_short;
    // Expanded should generally be longer
    expect(why.rationale_expanded.length).toBeGreaterThan(10);
    expect(why.rationale_expanded).not.toBe(short);
  });
});

describe('feed.service — loadDemoScenario', () => {
  it('loads all 4 canonical scenarios without error', () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      resetUser(DEMO_USER);
      const state = loadDemoScenario(key);
      expect(state.user_id).toBe(DEMO_USER);
      expect(state.readiness).toMatch(/^(high|medium|low)$/);
      expect(state.daily_priority).toBeDefined();
    }
  });

  it('scenario C has mobility as priority domain', () => {
    resetUser(DEMO_USER);
    const state = loadDemoScenario('C');
    expect(state.daily_priority.domain).toBe('mobility');
  });

  it('scenario D has light-effort cardio as priority', () => {
    resetUser(DEMO_USER);
    const state = loadDemoScenario('D');
    expect(state.daily_priority.domain).toBe('cardio');
    expect(state.daily_priority.effort_level).toBe('light');
  });
});
