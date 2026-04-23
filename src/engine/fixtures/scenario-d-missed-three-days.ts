/**
 * Scenario D — Missed-three-days Friday
 * Spec §10: session_skipped Mon/Tue/Wed, no discomfort, neutral tap, stress elevated.
 */
import type { ScenarioFixture, UserModel } from '../types';

export const scenarioDUserModel: UserModel = {
  user_id: 'sienna',
  segment: 'everyday',
  goals: [
    { tag: 'consistency', weight: 3 },
    { tag: 'cardio', weight: 2 },
    { tag: 'recovery', weight: 2 },
    { tag: 'stress_management', weight: 2 },
  ],
  preferences: {
    gear: [],
    time_context: 'afternoon',
  },
  constraints: {
    discomfort_areas: [],
  },
  recent_behavior: {
    sessions_this_week: 0,
    last_session_hours_ago: 96,
    last_session_domain: 'strength',
    sessions_skipped_streak: 3,
  },
  latest_body_state: {
    scan_flags: [],
    discomfort_flags: [],
  },
  latest_situation: {
    readiness: 'neutral',
    time_context: 'afternoon',
    sleep_hours: 6.5,
  },
};

export const scenarioD: ScenarioFixture = {
  user_id: 'sienna',
  user_model: scenarioDUserModel,
  seed_signals: [
    {
      signal_type: 'session_skipped',
      payload: { card_id: 'strength_lower_45min', reason: 'too busy' },
      hours_ago: 72,
    },
    {
      signal_type: 'session_skipped',
      payload: { card_id: 'strength_upper_40min', reason: 'too busy' },
      hours_ago: 48,
    },
    {
      signal_type: 'session_skipped',
      payload: { card_id: 'cardio_moderate_35min', reason: 'too tired' },
      hours_ago: 24,
    },
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'neutral' },
      hours_ago: 0,
    },
  ],
  expected_priority_domain: 'cardio',
  expected_priority_effort: 'light',
  expected_readiness: 'medium',
  expected_rationale_contains: ['reset', 'debt'],
};
