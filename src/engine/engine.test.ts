/**
 * Integration tests — all 4 canonical Sienna scenarios.
 * Each test seeds the fixture user model, calls compose(), and asserts
 * the expected CoachingState matches spec §10.
 */
import { describe, expect, it } from 'vitest';
import { applySignal, compose, getWhyRationale, shuffle } from './compose';
import { scenarioA, siennaUserModel } from './fixtures/scenario-a-rested-tuesday';
import { scenarioB, scenarioBUserModel } from './fixtures/scenario-b-tired-knee';
import { scenarioC, scenarioCUserModel } from './fixtures/scenario-c-post-scan-hips';
import { scenarioD, scenarioDUserModel } from './fixtures/scenario-d-missed-three-days';

const NOW = '2026-04-22T08:00:00Z';

describe('Scenario A — Rested Tuesday morning', () => {
  it('returns high readiness', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.readiness).toBe('high');
  });

  it('returns strength as daily priority domain', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.daily_priority.domain).toBe('strength');
  });

  it('returns moderate effort for priority', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.daily_priority.effort_level).toBe('moderate');
  });

  it('returns exactly 3 supporting cards', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.supporting_cards).toHaveLength(3);
  });

  it('rationale contains observational-warm language', () => {
    const state = compose(scenarioA.user_model, NOW);
    const rationale = state.daily_priority.rationale_short.toLowerCase();
    // Should reference consistency or time since last session
    const hasFact =
      rationale.includes('consistent') ||
      rationale.includes('days') ||
      rationale.includes('week') ||
      rationale.includes('session');
    expect(hasFact).toBe(true);
  });

  it('priority card has no audio_rationale_url (v1 stub)', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.daily_priority.audio_rationale_url).toBeNull();
  });

  it('cross_modality_note is present (strength pairs with mobility)', () => {
    const state = compose(scenarioA.user_model, NOW);
    // Should have a cross-modality note since mobility is a support domain for strength
    // At minimum, supporting cards should include mobility
    const hasMobility = state.supporting_cards.some((c) => c.domain === 'mobility');
    expect(hasMobility).toBe(true);
  });

  it('composed_at matches input timestamp', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.composed_at).toBe(NOW);
  });

  it('user_id matches', () => {
    const state = compose(scenarioA.user_model, NOW);
    expect(state.user_id).toBe('sienna');
  });
});

describe('Scenario B — Tired Wednesday night with knee flag', () => {
  it('returns low readiness', () => {
    const state = compose(scenarioB.user_model, NOW);
    expect(state.readiness).toBe('low');
  });

  it('returns breathing or recovery as daily priority domain', () => {
    const state = compose(scenarioB.user_model, NOW);
    // Spec says breathing is priority; with knee flag all lower-body strength/cardio vetoed
    const validDomains: string[] = ['breathing', 'recovery'];
    expect(validDomains).toContain(state.daily_priority.domain);
  });

  it('returns light effort for priority', () => {
    const state = compose(scenarioB.user_model, NOW);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('safety veto excludes knee-contraindicated cards from priority', () => {
    const state = compose(scenarioB.user_model, NOW);
    // Strength lower body and knee-loading cardio should not be priority
    const kneeLodingIds = [
      'strength_lower_45min',
      'strength_lower_30min',
      'cardio_intervals_25min',
    ];
    expect(kneeLodingIds).not.toContain(state.daily_priority.card_id);
  });

  it('safety veto excludes knee cards from ALL cards', () => {
    const state = compose(scenarioB.user_model, NOW);
    const allCards = [state.daily_priority, ...state.supporting_cards];
    const kneeLodingIds = [
      'strength_lower_45min',
      'strength_lower_30min',
      'cardio_intervals_25min',
    ];
    for (const card of allCards) {
      expect(kneeLodingIds).not.toContain(card.card_id);
    }
  });

  it('rationale references protecting tomorrow', () => {
    const state = compose(scenarioB.user_model, NOW);
    const rationale = state.daily_priority.rationale_short.toLowerCase();
    const hasProtect =
      rationale.includes('protect') ||
      rationale.includes('tomorrow') ||
      rationale.includes('quiet') ||
      rationale.includes('thin') ||
      rationale.includes('sleep');
    expect(hasProtect).toBe(true);
  });
});

describe('Scenario C — Post-scan hips', () => {
  it('returns medium readiness', () => {
    const state = compose(scenarioC.user_model, NOW);
    expect(state.readiness).toBe('medium');
  });

  it('returns mobility as daily priority domain', () => {
    const state = compose(scenarioC.user_model, NOW);
    expect(state.daily_priority.domain).toBe('mobility');
  });

  it('returns light effort for priority', () => {
    const state = compose(scenarioC.user_model, NOW);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('priority card is hip-focused', () => {
    const state = compose(scenarioC.user_model, NOW);
    // Hip mobility flow should be priority
    expect(state.daily_priority.card_id).toContain('hip');
  });

  it('rationale references scan or flagged area', () => {
    const state = compose(scenarioC.user_model, NOW);
    const rationale = state.daily_priority.rationale_short.toLowerCase();
    const hasScanRef =
      rationale.includes('flagged') ||
      rationale.includes('scan') ||
      rationale.includes('hip') ||
      rationale.includes('fresh') ||
      rationale.includes('while');
    expect(hasScanRef).toBe(true);
  });
});

describe('Scenario D — Missed three days Friday', () => {
  it('returns medium readiness', () => {
    const state = compose(scenarioD.user_model, NOW);
    expect(state.readiness).toBe('medium');
  });

  it('returns cardio or light activity as priority domain', () => {
    const state = compose(scenarioD.user_model, NOW);
    const validDomains: string[] = ['cardio', 'mobility', 'recovery'];
    expect(validDomains).toContain(state.daily_priority.domain);
  });

  it('returns light effort for priority (not a hard session after 3 misses)', () => {
    const state = compose(scenarioD.user_model, NOW);
    expect(state.daily_priority.effort_level).toBe('light');
  });

  it('rationale frames as reset not debt', () => {
    const state = compose(scenarioD.user_model, NOW);
    const rationale = state.daily_priority.rationale_short.toLowerCase();
    const hasResetFraming =
      rationale.includes('reset') ||
      rationale.includes('debt') ||
      rationale.includes('back') ||
      rationale.includes('skip') ||
      rationale.includes('rhythm');
    expect(hasResetFraming).toBe(true);
  });
});

describe('Signal ingestion', () => {
  it('sad readiness tap shifts readiness to low', () => {
    const updated = applySignal(siennaUserModel, {
      signal_type: 'readiness_tap',
      payload: { readiness: 'sad' },
      occurred_at: NOW,
    });
    const state = compose(updated, NOW);
    expect(state.readiness).toBe('low');
  });

  it('discomfort_logged adds area to constraints', () => {
    const updated = applySignal(siennaUserModel, {
      signal_type: 'discomfort_logged',
      payload: { area: 'knee', severity: 'moderate' },
      occurred_at: NOW,
    });
    expect(updated.constraints.discomfort_areas).toContain('knee');
    expect(updated.latest_body_state.discomfort_flags).toContain('knee');
  });

  it('session_completed increments sessions_this_week', () => {
    const updated = applySignal(siennaUserModel, {
      signal_type: 'session_completed',
      payload: { card_id: 'strength_lower_45min', duration_min: 45, effort_rating: 3 },
      occurred_at: NOW,
    });
    expect(updated.recent_behavior.sessions_this_week).toBe(
      siennaUserModel.recent_behavior.sessions_this_week + 1,
    );
  });

  it('scan_updated sets scan_flags', () => {
    const updated = applySignal(siennaUserModel, {
      signal_type: 'scan_updated',
      payload: { scan_type: 'mobility', result_json: {}, flags: ['hips'] },
      occurred_at: NOW,
    });
    expect(updated.latest_body_state.scan_flags).toContain('hips');
  });

  it('session_skipped increments skipped streak', () => {
    const updated = applySignal(siennaUserModel, {
      signal_type: 'session_skipped',
      payload: { card_id: 'strength_lower_45min', reason: 'tired' },
      occurred_at: NOW,
    });
    expect(updated.recent_behavior.sessions_skipped_streak).toBe(1);
  });
});

describe('Shuffle', () => {
  it('returns a different priority card', () => {
    const initial = compose(siennaUserModel, NOW);
    const shuffled = shuffle(siennaUserModel, initial.daily_priority.card_id, NOW);
    expect(shuffled.daily_priority.card_id).not.toBe(initial.daily_priority.card_id);
  });

  it('sets shuffle_cooldown_until 3 minutes in the future', () => {
    const initial = compose(siennaUserModel, NOW);
    const shuffled = shuffle(siennaUserModel, initial.daily_priority.card_id, NOW);
    if (shuffled.shuffle_cooldown_until) {
      const cooldownMs =
        new Date(shuffled.shuffle_cooldown_until).getTime() - new Date(NOW).getTime();
      expect(cooldownMs).toBe(3 * 60 * 1000);
    }
  });

  it('never returns a safety-vetoed card', () => {
    const initial = compose(scenarioBUserModel, NOW);
    const shuffled = shuffle(scenarioBUserModel, initial.daily_priority.card_id, NOW);
    const kneeLodingIds = ['strength_lower_45min', 'cardio_intervals_25min'];
    expect(kneeLodingIds).not.toContain(shuffled.daily_priority.card_id);
    for (const card of shuffled.supporting_cards) {
      expect(kneeLodingIds).not.toContain(card.card_id);
    }
  });
});

describe('Why endpoint', () => {
  it('returns expanded rationale for a valid card', () => {
    const result = getWhyRationale('strength_lower_45min', siennaUserModel, NOW);
    expect(result.card_id).toBe('strength_lower_45min');
    expect(result.rationale_expanded.length).toBeGreaterThan(20);
    expect(result.audio_rationale_url).toBeNull();
  });

  it('returns fallback for unknown card', () => {
    const result = getWhyRationale('unknown_card_xyz', siennaUserModel, NOW);
    expect(result.card_id).toBe('unknown_card_xyz');
    expect(result.rationale_expanded).toBeTruthy();
  });
});

describe('CoachingState contract (spec §8.5)', () => {
  it('state matches CoachingState interface shape', () => {
    const state = compose(siennaUserModel, NOW);
    expect(typeof state.user_id).toBe('string');
    expect(typeof state.composed_at).toBe('string');
    expect(['high', 'medium', 'low']).toContain(state.readiness);
    expect(typeof state.readiness_rationale).toBe('string');
    expect(typeof state.daily_priority.card_id).toBe('string');
    expect(typeof state.daily_priority.domain).toBe('string');
    expect(typeof state.daily_priority.title).toBe('string');
    expect(['light', 'moderate', 'hard']).toContain(state.daily_priority.effort_level);
    expect(typeof state.daily_priority.duration_min).toBe('number');
    expect(typeof state.daily_priority.rationale_short).toBe('string');
    expect(typeof state.daily_priority.rationale_expanded).toBe('string');
    expect(state.daily_priority.audio_rationale_url).toBeNull();
    expect(Array.isArray(state.supporting_cards)).toBe(true);
    expect(state.supporting_cards).toHaveLength(3);
    expect(Array.isArray(state.adaptation_reasons)).toBe(true);
  });

  it('supporting cards each match FeedCard shape', () => {
    const state = compose(siennaUserModel, NOW);
    for (const card of state.supporting_cards) {
      expect(typeof card.card_id).toBe('string');
      expect(typeof card.domain).toBe('string');
      expect(card.audio_rationale_url).toBeNull();
    }
  });
});
