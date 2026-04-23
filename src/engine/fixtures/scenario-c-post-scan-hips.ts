/**
 * Scenario C — Post-scan Sienna (mobility scan flags hips)
 * Spec §10: scan_updated one hour ago flagging hip mobility below baseline, neutral tap.
 */
import type { ScenarioFixture, UserModel } from '../types';

export const scenarioCUserModel: UserModel = {
  user_id: 'sienna',
  segment: 'everyday',
  goals: [
    { tag: 'mobility', weight: 3 },
    { tag: 'injury_prevention', weight: 3 },
    { tag: 'strength', weight: 2 },
    { tag: 'recovery', weight: 2 },
  ],
  preferences: {
    gear: [],
    time_context: 'afternoon',
  },
  constraints: {
    discomfort_areas: [],
  },
  recent_behavior: {
    sessions_this_week: 2,
    last_session_hours_ago: 48,
    last_session_domain: 'strength',
    sessions_skipped_streak: 0,
  },
  latest_body_state: {
    scan_flags: ['hips'],
    discomfort_flags: [],
  },
  latest_situation: {
    readiness: 'neutral',
    time_context: 'afternoon',
    sleep_hours: 7.0,
  },
};

export const scenarioC: ScenarioFixture = {
  user_id: 'sienna',
  user_model: scenarioCUserModel,
  seed_signals: [
    {
      signal_type: 'scan_updated',
      payload: {
        scan_type: 'mobility',
        result_json: { area: 'hips', score: 45, baseline: 70 },
        flags: ['hips'],
      },
      hours_ago: 1,
    },
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'neutral' },
      hours_ago: 0,
    },
  ],
  expected_priority_domain: 'mobility',
  expected_priority_effort: 'light',
  expected_readiness: 'medium',
  expected_rationale_contains: ['flagged', 'fresh'],
};
