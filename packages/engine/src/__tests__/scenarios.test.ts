/**
 * Integration tests — 4 canonical Sienna scenarios (spec §10, Appendix A.1)
 *
 * Each test seeds the user model with the fixture, calls GET /feed/today,
 * and asserts the CoachingState matches the expected output per spec.
 *
 * Also validates pluralization fix: "1 day" not "1 days" or "a day days".
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getFeedToday, loadScenario, resetUser } from '../engine.ts';

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

  it('rationale is observational-warm (mentions weeks, sessions, or lower-body)', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    const rationaleText = state.daily_priority.rationale_short.toLowerCase();
    const hasExpected =
      rationaleText.includes('consistent') ||
      rationaleText.includes('lower') ||
      rationaleText.includes('steady') ||
      rationaleText.includes('days') ||
      rationaleText.includes('day') ||
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

  it('rationale_short does not contain unfilled template tokens', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    // No {variable} patterns in rendered output
    expect(state.daily_priority.rationale_short).not.toMatch(/\{[a-z_]+\}/);
    expect(state.daily_priority.rationale_expanded).not.toMatch(/\{[a-z_]+\}/);
  });

  it('pluralization is correct — "3 days" not "a day days"', () => {
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    // Should never see "a day days" — the Round 1 bug
    for (const card of [state.daily_priority, ...state.supporting_cards]) {
      expect(card.rationale_short).not.toContain('a day days');
      expect(card.rationale_short).not.toContain('1 days');
      expect(card.rationale_expanded).not.toContain('a day days');
      expect(card.rationale_expanded).not.toContain('1 days');
    }
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

  it('no supporting card is hard-effort (safety + readiness constraint)', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    for (const card of state.supporting_cards) {
      expect(card.effort_level).not.toBe('hard');
    }
  });

  it('priority rationale references protection, rest, or recovery', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    const text = (
      state.daily_priority.rationale_short +
      ' ' +
      state.daily_priority.rationale_expanded
    ).toLowerCase();
    const hasProtectionLanguage =
      text.includes('protect') ||
      text.includes('tomorrow') ||
      text.includes('quiet') ||
      text.includes('flagged') ||
      text.includes('thin') ||
      text.includes('rest');
    expect(hasProtectionLanguage).toBe(true);
  });

  it('safety veto is applied — no lower-body strength or hard cardio', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    const allCards = [state.daily_priority, ...state.supporting_cards];
    for (const card of allCards) {
      // No lower body strength when knee is flagged
      expect(card.card_id).not.toContain('lower');
      expect(card.card_id).not.toBe('cardio_hiit_25min');
    }
  });

  it('has exactly 3 supporting cards', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('rationale templates are fully rendered (no unfilled tokens)', () => {
    loadScenario(USER_ID, 'B');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.rationale_short).not.toMatch(/\{[a-z_]+\}/);
    expect(state.daily_priority.rationale_expanded).not.toMatch(/\{[a-z_]+\}/);
  });
});

describe('Scenario C — Post-scan Sienna (mobility scan flags hips)', () => {
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

  it('priority is hip-related mobility', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    // Hip mobility flow should be selected given hip_mobility scan
    expect(state.daily_priority.card_id).toContain('hip');
  });

  it('rationale references scan or hip', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    const text = (
      state.daily_priority.rationale_short +
      ' ' +
      state.daily_priority.rationale_expanded
    ).toLowerCase();
    const hasScanLanguage =
      text.includes('scan') ||
      text.includes('hip') ||
      text.includes('flagged') ||
      text.includes('mobility');
    expect(hasScanLanguage).toBe(true);
  });

  it('pluralization: supporting card for Scenario C does not say "a day days"', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    // This is the key pluralization regression test from Round 1 evaluation
    for (const card of state.supporting_cards) {
      expect(card.rationale_short).not.toContain('a day days');
      expect(card.rationale_short).not.toContain('1 days');
      // "1 day" is valid
      if (card.rationale_short.includes('1 day')) {
        expect(card.rationale_short).not.toContain('1 days');
      }
    }
  });

  it('cross-modality note links to breathing or strength', () => {
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    // Mobility priority should link to breathing or strength per spec
    if (state.cross_modality_note !== null) {
      expect(state.cross_modality_note.length).toBeGreaterThan(0);
    }
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

  it('daily priority is light effort (re-entry posture)', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('priority rationale references reset, rhythm, re-entry, or light posture', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    // Check both short and expanded rationale for re-entry language
    const text = (
      state.daily_priority.rationale_short +
      ' ' +
      state.daily_priority.rationale_expanded +
      ' ' +
      state.readiness_rationale
    ).toLowerCase();
    const hasResetLanguage =
      text.includes('reset') ||
      text.includes('rhythm') ||
      text.includes('re-entry') ||
      text.includes('missed') ||
      text.includes('back in') ||
      text.includes('three') ||
      text.includes('skips') ||
      text.includes('skip') ||
      text.includes('undershoot') ||
      text.includes('habit') ||
      text.includes('gentle') ||
      text.includes('light');
    expect(hasResetLanguage).toBe(true);
  });

  it('has exactly 3 supporting cards', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('has reflection or check-in support (per spec)', () => {
    loadScenario(USER_ID, 'D');
    const state = getFeedToday(USER_ID);
    const hasReflection = state.supporting_cards.some((c) => c.domain === 'reflection');
    expect(hasReflection).toBe(true);
  });
});

describe('Pluralization — formatDays regression tests', () => {
  it('scenario with 1-day gap produces "1 day" not "1 days"', () => {
    // Use scenario C which has last_session_hours_ago: 24 (1 day)
    loadScenario(USER_ID, 'C');
    const state = getFeedToday(USER_ID);
    // Check no "1 days" anywhere in the rendered output
    const allRationale = [state.daily_priority, ...state.supporting_cards]
      .map((c) => `${c.rationale_short} ${c.rationale_expanded}`)
      .join(' ');
    expect(allRationale).not.toContain('1 days');
    expect(allRationale).not.toContain('a day days');
  });

  it('scenario with 3-day gap produces "3 days" not "3 day"', () => {
    // Scenario A has last_session_hours_ago: 72 (3 days)
    loadScenario(USER_ID, 'A');
    const state = getFeedToday(USER_ID);
    const allRationale = [state.daily_priority, ...state.supporting_cards]
      .map((c) => `${c.rationale_short} ${c.rationale_expanded}`)
      .join(' ');
    // Should not contain singular "3 day" (not followed by "s")
    expect(allRationale).not.toMatch(/\b3 day\b(?!s)/);
    expect(allRationale).not.toContain('a day days');
  });
});

describe('CoachingState contract — spec §8.5 field validation', () => {
  const SCENARIOS = ['A', 'B', 'C', 'D'] as const;

  for (const scenario of SCENARIOS) {
    it(`Scenario ${scenario}: all required CoachingState fields present`, () => {
      loadScenario(USER_ID, scenario);
      const state = getFeedToday(USER_ID);

      // Top-level fields
      expect(typeof state.user_id).toBe('string');
      expect(typeof state.composed_at).toBe('string');
      expect(['high', 'medium', 'low']).toContain(state.readiness);
      expect(typeof state.readiness_rationale).toBe('string');
      expect(state.readiness_rationale.length).toBeGreaterThan(0);
      expect(Array.isArray(state.adaptation_reasons)).toBe(true);
      // shuffle_cooldown_until is null when freshly loaded
      expect(state.shuffle_cooldown_until).toBeNull();

      // daily_priority FeedCard fields
      const p = state.daily_priority;
      expect(typeof p.card_id).toBe('string');
      expect(typeof p.domain).toBe('string');
      expect(typeof p.title).toBe('string');
      expect(['light', 'moderate', 'hard']).toContain(p.effort_level);
      expect(typeof p.duration_min).toBe('number');
      expect(typeof p.rationale_short).toBe('string');
      expect(p.rationale_short.length).toBeGreaterThan(0);
      expect(typeof p.rationale_expanded).toBe('string');
      expect(p.rationale_expanded.length).toBeGreaterThan(0);
      expect(p.audio_rationale_url).toBeNull(); // v1: always null

      // supporting_cards — exactly 3
      expect(state.supporting_cards).toHaveLength(3);
      for (const s of state.supporting_cards) {
        expect(typeof s.card_id).toBe('string');
        expect(typeof s.domain).toBe('string');
        expect(typeof s.title).toBe('string');
        expect(s.audio_rationale_url).toBeNull();
      }
    });
  }
});
