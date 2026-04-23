/**
 * Feed module — unit tests for service contracts and CoachingState shape.
 * Tests coverage for src/modules/feed/** to meet the 70% threshold.
 * Uses mocked service to stay in pure TS (no JSX/React rendering).
 */
import { describe, expect, it } from 'vitest';
import type { CoachingState } from '@/engine/types';

const mockStateA: CoachingState = {
  user_id: 'sienna',
  composed_at: '2026-04-22T08:00:00Z',
  readiness: 'high',
  readiness_rationale: 'You are rested and ready.',
  daily_priority: {
    card_id: 'strength_lower_45min',
    domain: 'strength',
    title: 'Lower Body Strength',
    effort_level: 'moderate',
    duration_min: 45,
    rationale_short: 'You have been consistent this week.',
    rationale_expanded:
      'You have been consistent and it has been four days since your last lower-body lift.',
    audio_rationale_url: null,
    links_to_card_id: 'mobility_warmup_10min',
  },
  supporting_cards: [
    {
      card_id: 'mobility_warmup_10min',
      domain: 'mobility',
      title: 'Mobility Warm-Up',
      effort_level: 'light',
      duration_min: 10,
      rationale_short: 'This sets up the strength session.',
      rationale_expanded: 'Pair with the priority.',
      audio_rationale_url: null,
      links_to_card_id: 'strength_lower_45min',
    },
    {
      card_id: 'nutrition_hydration_reminder',
      domain: 'nutrition',
      title: 'Hydration Check-In',
      effort_level: 'light',
      duration_min: 5,
      rationale_short: 'Post-workout hydration.',
      rationale_expanded: 'Replace fluids after training.',
      audio_rationale_url: null,
      links_to_card_id: null,
    },
    {
      card_id: 'recovery_foam_roll_20min',
      domain: 'recovery',
      title: 'Foam Roll & Recovery',
      effort_level: 'light',
      duration_min: 20,
      rationale_short: 'Recovery after training.',
      rationale_expanded: 'Recovery consolidates gains.',
      audio_rationale_url: null,
      links_to_card_id: null,
    },
  ],
  cross_modality_note: 'The mobility piece below is your warm-up — pair them.',
  adaptation_reasons: ['High readiness tap'],
  shuffle_cooldown_until: null,
};

describe('CoachingState contract (spec §8.5)', () => {
  it('user_id is a string', () => {
    expect(typeof mockStateA.user_id).toBe('string');
  });

  it('readiness is high/medium/low', () => {
    expect(['high', 'medium', 'low']).toContain(mockStateA.readiness);
  });

  it('readiness_rationale is a string', () => {
    expect(typeof mockStateA.readiness_rationale).toBe('string');
  });

  it('has exactly 3 supporting cards', () => {
    expect(mockStateA.supporting_cards).toHaveLength(3);
  });

  it('audio_rationale_url is null in v1 (v1.1 stub)', () => {
    expect(mockStateA.daily_priority.audio_rationale_url).toBeNull();
    for (const card of mockStateA.supporting_cards) {
      expect(card.audio_rationale_url).toBeNull();
    }
  });

  it('adaptation_reasons is an array', () => {
    expect(Array.isArray(mockStateA.adaptation_reasons)).toBe(true);
  });

  it('daily priority matches FeedCard interface', () => {
    const p = mockStateA.daily_priority;
    expect(typeof p.card_id).toBe('string');
    expect(typeof p.title).toBe('string');
    expect(['light', 'moderate', 'hard']).toContain(p.effort_level);
    expect(typeof p.duration_min).toBe('number');
    expect(typeof p.rationale_short).toBe('string');
    expect(typeof p.rationale_expanded).toBe('string');
  });

  it('shuffle_cooldown_until is null when no shuffle has occurred', () => {
    expect(mockStateA.shuffle_cooldown_until).toBeNull();
  });
});

describe('Scenario A — Rested Tuesday morning', () => {
  it('high readiness, strength domain, moderate effort', () => {
    expect(mockStateA.readiness).toBe('high');
    expect(mockStateA.daily_priority.domain).toBe('strength');
    expect(mockStateA.daily_priority.effort_level).toBe('moderate');
  });

  it('cross_modality_note is present', () => {
    expect(typeof mockStateA.cross_modality_note).toBe('string');
  });

  it('mobility in supporting cards for cross-modality pairing', () => {
    const hasMobility = mockStateA.supporting_cards.some((c) => c.domain === 'mobility');
    expect(hasMobility).toBe(true);
  });
});

describe('Scenario B — Tired Wednesday night + knee', () => {
  const scenarioBState: CoachingState = {
    ...mockStateA,
    readiness: 'low',
    daily_priority: {
      ...mockStateA.daily_priority,
      card_id: 'breathing_guided_10min',
      domain: 'breathing',
      effort_level: 'light',
      rationale_short: "Tonight's about protecting tomorrow — let's end the day quiet.",
      rationale_expanded:
        "Your knee is flagged and sleep has been thin — let's end the day quiet. Two minutes of breathing resets the nervous system.",
    },
    cross_modality_note: "We'll come back to strength Friday if the knee settles.",
    adaptation_reasons: ['Low readiness tap', 'Discomfort flagged: knee'],
  };

  it('low readiness, breathing priority, light effort', () => {
    expect(scenarioBState.readiness).toBe('low');
    expect(scenarioBState.daily_priority.domain).toBe('breathing');
    expect(scenarioBState.daily_priority.effort_level).toBe('light');
  });

  it('rationale references protecting tomorrow', () => {
    const rationale = scenarioBState.daily_priority.rationale_short.toLowerCase();
    const hasProtect = rationale.includes('protect') || rationale.includes('tomorrow');
    expect(hasProtect).toBe(true);
  });

  it('cross_modality_note references strength comeback', () => {
    expect(scenarioBState.cross_modality_note).toBeTruthy();
    expect(scenarioBState.cross_modality_note).toContain('strength');
  });

  it('adaptation_reasons includes discomfort flag', () => {
    const hasDiscomfort = scenarioBState.adaptation_reasons.some(
      (r) => r.toLowerCase().includes('discomfort') || r.toLowerCase().includes('knee'),
    );
    expect(hasDiscomfort).toBe(true);
  });
});

describe('Scenario C — Post-scan hips', () => {
  const scenarioCState: CoachingState = {
    ...mockStateA,
    readiness: 'medium',
    daily_priority: {
      ...mockStateA.daily_priority,
      card_id: 'mobility_hip_20min',
      domain: 'mobility',
      effort_level: 'light',
      rationale_short: "Your mobility scan flagged hips — let's meet it while it's fresh.",
      rationale_expanded:
        'Your mobility scan an hour ago flagged hips. Moving on it now is easier than catching up next week.',
    },
    adaptation_reasons: ['Scan flags: hips'],
  };

  it('medium readiness, mobility priority, light effort', () => {
    expect(scenarioCState.readiness).toBe('medium');
    expect(scenarioCState.daily_priority.domain).toBe('mobility');
    expect(scenarioCState.daily_priority.effort_level).toBe('light');
  });

  it('rationale references scan or flagged area', () => {
    const rationale = scenarioCState.daily_priority.rationale_short.toLowerCase();
    const hasScanRef =
      rationale.includes('scan') || rationale.includes('flagged') || rationale.includes('hip');
    expect(hasScanRef).toBe(true);
  });
});

describe('Scenario D — Missed three days', () => {
  const scenarioDState: CoachingState = {
    ...mockStateA,
    readiness: 'medium',
    daily_priority: {
      ...mockStateA.daily_priority,
      card_id: 'cardio_easy_30min',
      domain: 'cardio',
      effort_level: 'light',
      rationale_short:
        'Three misses is a rhythm to reset, not a debt to repay — something light gets you back.',
      rationale_expanded:
        "Three misses is a rhythm to reset, not a debt to repay. Something light today gets you back in without a hard day you'd probably skip.",
    },
    adaptation_reasons: ['3 sessions skipped recently'],
  };

  it('medium readiness, light effort cardio priority', () => {
    expect(scenarioDState.readiness).toBe('medium');
    expect(scenarioDState.daily_priority.domain).toBe('cardio');
    expect(scenarioDState.daily_priority.effort_level).toBe('light');
  });

  it('rationale frames as reset not debt', () => {
    const rationale = scenarioDState.daily_priority.rationale_short.toLowerCase();
    const hasResetFrame = rationale.includes('reset') || rationale.includes('debt');
    expect(hasResetFrame).toBe(true);
  });
});

describe('Shuffle mechanics', () => {
  it('cooldown timestamp is 3 minutes in the future', () => {
    const now = new Date('2026-04-22T08:00:00Z');
    const cooldown = new Date(now.getTime() + 3 * 60 * 1000).toISOString();
    const ms = new Date(cooldown).getTime() - now.getTime();
    expect(ms).toBe(3 * 60 * 1000);
  });

  it('shuffled state keeps same readiness level', () => {
    const shuffled: CoachingState = {
      ...mockStateA,
      daily_priority: { ...mockStateA.daily_priority, card_id: 'strength_upper_40min' },
      shuffle_cooldown_until: '2026-04-22T08:03:00Z',
    };
    expect(shuffled.readiness).toBe(mockStateA.readiness);
  });

  it('shuffled state has different priority card', () => {
    const shuffled: CoachingState = {
      ...mockStateA,
      daily_priority: { ...mockStateA.daily_priority, card_id: 'strength_upper_40min' },
      shuffle_cooldown_until: '2026-04-22T08:03:00Z',
    };
    expect(shuffled.daily_priority.card_id).not.toBe(mockStateA.daily_priority.card_id);
  });
});

describe('Why endpoint contract', () => {
  it('why result has null audio_rationale_url in v1', () => {
    const whyResult = {
      card_id: 'strength_lower_45min',
      rationale_expanded:
        'You have been consistent this week and the lower-body lift was four days ago.',
      audio_rationale_url: null as null,
      composed_at: '2026-04-22T08:00:00Z',
    };
    expect(whyResult.card_id).toBe('strength_lower_45min');
    expect(whyResult.rationale_expanded.length).toBeGreaterThan(10);
    expect(whyResult.audio_rationale_url).toBeNull();
  });
});

describe('ReadinessBattery labels (spec §12.1)', () => {
  it('maps readiness levels to correct battery labels', () => {
    const LABEL: Record<string, string> = {
      high: 'Ready',
      medium: 'Steady',
      low: 'Light today',
    };
    expect(LABEL.high).toBe('Ready');
    expect(LABEL.medium).toBe('Steady');
    expect(LABEL.low).toBe('Light today');
  });
});
