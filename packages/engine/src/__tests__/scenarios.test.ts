/**
 * Integration tests — 4 canonical Sienna scenarios (spec §10, Appendix A.1)
 *
 * Each test seeds the user model with the fixture, calls GET /feed/today,
 * and asserts the CoachingState matches the expected output per spec.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScenario, getFeedToday, resetUser } from '../engine.ts';

const USER_ID = 'sienna_test';

beforeEach(() => {
  resetUser(USER_ID);
});

describe('Scenario A — Rested Tuesday morning', () => {
  it('produces high readiness', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.readiness).toBe('high');
  });

  it('daily priority is in strength domain', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.domain).toBe('strength');
  });

  it('daily priority is moderate effort', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.effort_level).toBe('moderate');
  });

  it('rationale is observational-warm (mentions days, week, or consistency)', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    const rationaleText = state.daily_priority.rationale_short.toLowerCase();
    const hasExpected =
      rationaleText.includes('consistent') ||
      rationaleText.includes('lower') ||
      rationaleText.includes('steady') ||
      rationaleText.includes('days') ||
      rationaleText.includes('week') ||
      rationaleText.includes('sessions');
    expect(hasExpected).toBe(true);
  });

  it('has exactly 3 supporting cards', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('has cross-modality note (mobility or nutrition paired with strength)', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.cross_modality_note).not.toBeNull();
  });

  it('CoachingState has all required fields', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(state.user_id).toBe(USER_ID);
    expect(state.composed_at).toBeTruthy();
    expect(state.readiness_rationale).toBeTruthy();
    expect(state.adaptation_reasons).toBeDefined();
    expect(state.shuffle_cooldown_until).toBeNull();
  });
});

describe('Scenario B — Tired Wednesday night with knee flag', () => {
  it('produces low readiness', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    expect(state.readiness).toBe('low');
  });

  it('daily priority is in breathing domain (safety veto on knee)', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.domain).toBe('breathing');
  });

  it('daily priority is light effort', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('no supporting card is hard-effort cardio with knee risk', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    for (const card of state.supporting_cards) {
      // No hard effort cards when readiness is low
      expect(card.effort_level).not.toBe('hard');
    }
  });

  it('priority rationale references protection, rest, or recovery', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    const text = state.daily_priority.rationale_short.toLowerCase();
    const hasProtection =
      text.includes('protect') ||
      text.includes('quiet') ||
      text.includes('tomorrow') ||
      text.includes('rest') ||
      text.includes('thin') ||
      text.includes('flag') ||
      text.includes('knee') ||
      text.includes('end') ||
      text.includes('day');
    expect(hasProtection).toBe(true);
  });

  it('readiness rationale mentions discomfort or sleep', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    const text = state.readiness_rationale.toLowerCase();
    const hasCue =
      text.includes('knee') ||
      text.includes('sleep') ||
      text.includes('thin') ||
      text.includes('flag') ||
      text.includes('tomorrow') ||
      text.includes('short');
    expect(hasCue).toBe(true);
  });
});

describe('Scenario C — Post-scan Sienna (hip mobility flagged)', () => {
  it('produces medium readiness', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    expect(state.readiness).toBe('medium');
  });

  it('daily priority is in mobility domain', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.domain).toBe('mobility');
  });

  it('daily priority is light effort', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('priority rationale references scan, hip, or mobility', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    const text = state.daily_priority.rationale_short.toLowerCase();
    const hasScanRef =
      text.includes('scan') ||
      text.includes('hip') ||
      text.includes('flag') ||
      text.includes('fresh') ||
      text.includes('mobility') ||
      text.includes('warm-up') ||
      text.includes('pair');
    expect(hasScanRef).toBe(true);
  });

  it('has 3 supporting cards', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('cross-modality note or linked card exists', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    const hasLink =
      state.cross_modality_note !== null ||
      state.supporting_cards.some((c) => c.links_to_card_id !== null);
    expect(hasLink).toBe(true);
  });
});

describe('Scenario D — Missed-three-days Friday', () => {
  it('produces medium readiness', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    expect(state.readiness).toBe('medium');
  });

  it('daily priority is in cardio domain (light re-entry)', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.domain).toBe('cardio');
  });

  it('daily priority is light effort (not a hard session)', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('priority rationale references missed sessions or re-entry', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    const text = state.daily_priority.rationale_short.toLowerCase();
    // Accept any template variant from the easy cardio card
    const hasResetCue =
      text.includes('reset') ||
      text.includes('rhythm') ||
      text.includes('miss') ||
      text.includes('back') ||
      text.includes('re-entry') ||
      text.includes('reestabl') ||
      text.includes('debt') ||
      text.includes('habit') ||
      text.includes('few days') ||
      text.includes('gap');
    expect(hasResetCue).toBe(true);
  });

  it('adaptation_reasons mentions skips', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    const reasons = state.adaptation_reasons.join(' ').toLowerCase();
    expect(reasons.includes('skip')).toBe(true);
  });
});

describe('Engine API contract', () => {
  it('all FeedCards have audio_rationale_url: null (v1.1 stub)', () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      resetUser(USER_ID);
      loadScenario(USER_ID, key);
      const state = getFeedToday(USER_ID);
      expect(state.daily_priority.audio_rationale_url).toBeNull();
      for (const card of state.supporting_cards) {
        expect(card.audio_rationale_url).toBeNull();
      }
    }
  });

  it('composed_at is a valid ISO timestamp', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    expect(() => new Date(state.composed_at)).not.toThrow();
    expect(new Date(state.composed_at).getTime()).toBeGreaterThan(0);
  });

  it('each supporting card has required fields', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    for (const card of state.supporting_cards) {
      expect(card.card_id).toBeTruthy();
      expect(card.domain).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.rationale_short).toBeTruthy();
      expect(card.rationale_expanded).toBeTruthy();
    }
  });
});
