/**
 * Scenario A — Rested Tuesday morning
 * Spec §10: sleep 7h02m average, last session Saturday (strength), no discomfort, readiness tap: happy.
 */
import type { ScenarioFixture, UserModel } from '../types';

export const siennaUserModel: UserModel = {
  user_id: 'sienna',
  segment: 'everyday',
  goals: [
    { tag: 'strength', weight: 3 },
    { tag: 'muscle', weight: 2 },
    { tag: 'mobility', weight: 2 },
    { tag: 'recovery', weight: 1 },
    { tag: 'consistency', weight: 2 },
  ],
  preferences: {
    gear: [],
    time_context: 'morning',
  },
  constraints: {
    discomfort_areas: [],
  },
  recent_behavior: {
    sessions_this_week: 3,
    last_session_hours_ago: 72, // Saturday → Tuesday = 3 days
    last_session_domain: 'strength',
    sessions_skipped_streak: 0,
  },
  latest_body_state: {
    scan_flags: [],
    discomfort_flags: [],
  },
  latest_situation: {
    readiness: 'happy',
    time_context: 'morning',
    sleep_hours: 7.03,
  },
};

export const scenarioA: ScenarioFixture = {
  user_id: 'sienna',
  user_model: siennaUserModel,
  seed_signals: [
    {
      signal_type: 'session_completed',
      payload: { card_id: 'strength_full_55min', duration_min: 55, effort_rating: 4 },
      hours_ago: 72,
    },
    {
      signal_type: 'session_completed',
      payload: { card_id: 'cardio_easy_30min', duration_min: 30, effort_rating: 2 },
      hours_ago: 96,
    },
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'happy' },
      hours_ago: 0,
    },
  ],
  expected_priority_domain: 'strength',
  expected_priority_effort: 'moderate',
  expected_readiness: 'high',
  expected_rationale_contains: ['consistent', 'days', 'lower'],
};
