/**
 * Scenario B — Tired Wednesday night with knee flag
 * Spec §10: sleep 5h30m, skipped Wednesday strength, left knee discomfort, readiness tap: sad.
 */
import type { ScenarioFixture, UserModel } from '../types';

export const scenarioBUserModel: UserModel = {
  user_id: 'sienna',
  segment: 'everyday',
  goals: [
    { tag: 'strength', weight: 3 },
    { tag: 'muscle', weight: 2 },
    { tag: 'recovery', weight: 2 },
    { tag: 'stress_management', weight: 1 },
  ],
  preferences: {
    gear: [],
    time_context: 'evening',
  },
  constraints: {
    discomfort_areas: ['knee'],
  },
  recent_behavior: {
    sessions_this_week: 1,
    last_session_hours_ago: 72,
    last_session_domain: 'strength',
    sessions_skipped_streak: 1,
  },
  latest_body_state: {
    scan_flags: [],
    discomfort_flags: ['knee'],
  },
  latest_situation: {
    readiness: 'sad',
    time_context: 'evening',
    sleep_hours: 5.5,
  },
};

export const scenarioB: ScenarioFixture = {
  user_id: 'sienna',
  user_model: scenarioBUserModel,
  seed_signals: [
    {
      signal_type: 'session_skipped',
      payload: { card_id: 'strength_lower_45min', reason: 'too tired' },
      hours_ago: 12,
    },
    {
      signal_type: 'discomfort_logged',
      payload: { area: 'knee', severity: 'moderate' },
      hours_ago: 4,
    },
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'sad' },
      hours_ago: 0,
    },
  ],
  expected_priority_domain: 'breathing',
  expected_priority_effort: 'light',
  expected_readiness: 'low',
  expected_rationale_contains: ['protecting', 'tomorrow'],
};
