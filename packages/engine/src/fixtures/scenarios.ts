/**
 * Four canonical Sienna scenarios — spec §10, Appendix A.1
 */
import type { ScenarioFixture } from '../types.ts';

/**
 * Scenario A — Rested Tuesday morning
 * Readiness: high | Priority domain: strength | Effort: moderate
 */
export const scenarioA: ScenarioFixture = {
  user_id: 'sienna',
  seed_signals: [
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'happy' },
      hours_ago: 0,
      occurred_at: new Date().toISOString(),
    },
  ],
  user_model_overrides: {
    recent_behavior_json: {
      sessions_completed_7d: 3,
      sessions_skipped_7d: 0,
      domains_touched_7d: ['strength', 'cardio'],
      last_session_card_id: 'strength_full_55min',
      last_session_hours_ago: 72,
      avg_sleep_hours_7d: 7.02,
      stress_level: 'low',
    },
    latest_situation_json: {
      readiness: 'happy',
      latest_mood: null,
      time_context: 'morning',
    },
    constraints_json: {
      discomfort_areas: [],
      medical_context_tags: [],
    },
    latest_body_state_json: {
      discomfort_flags: [],
      last_scan_result: null,
      last_scan_hours_ago: null,
      scan_type: null,
    },
  },
  expected_priority_domain: 'strength',
  expected_priority_effort: 'moderate',
  expected_readiness: 'high',
  expected_rationale_contains: ['consistent', 'lower-body'],
};

/**
 * Scenario B — Tired Wednesday night with knee flag
 * Readiness: low | Priority domain: breathing | Effort: light
 */
export const scenarioB: ScenarioFixture = {
  user_id: 'sienna',
  seed_signals: [
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'sad' },
      hours_ago: 0,
      occurred_at: new Date().toISOString(),
    },
  ],
  user_model_overrides: {
    recent_behavior_json: {
      sessions_completed_7d: 1,
      sessions_skipped_7d: 1,
      domains_touched_7d: ['strength'],
      last_session_card_id: 'cardio_easy_30min',
      last_session_hours_ago: 48,
      avg_sleep_hours_7d: 5.5,
      stress_level: 'high',
    },
    latest_situation_json: {
      readiness: 'sad',
      latest_mood: null,
      time_context: 'evening',
    },
    constraints_json: {
      discomfort_areas: ['knee'],
      medical_context_tags: [],
    },
    latest_body_state_json: {
      discomfort_flags: ['knee'],
      last_scan_result: null,
      last_scan_hours_ago: null,
      scan_type: null,
    },
  },
  expected_priority_domain: 'breathing',
  expected_priority_effort: 'light',
  expected_readiness: 'low',
  expected_rationale_contains: ['protecting', 'tomorrow'],
};

/**
 * Scenario C — Post-scan Sienna (mobility scan flags hips)
 * Readiness: medium | Priority domain: mobility | Effort: light
 */
export const scenarioC: ScenarioFixture = {
  user_id: 'sienna',
  seed_signals: [
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'neutral' },
      hours_ago: 0,
      occurred_at: new Date().toISOString(),
    },
  ],
  user_model_overrides: {
    recent_behavior_json: {
      sessions_completed_7d: 2,
      sessions_skipped_7d: 0,
      domains_touched_7d: ['strength', 'cardio'],
      last_session_card_id: 'cardio_easy_30min',
      last_session_hours_ago: 24,
      avg_sleep_hours_7d: 7.0,
      stress_level: 'low',
    },
    latest_situation_json: {
      readiness: 'neutral',
      latest_mood: null,
      time_context: 'afternoon',
    },
    constraints_json: {
      discomfort_areas: ['hip_mobility_scan'],
      medical_context_tags: [],
    },
    latest_body_state_json: {
      discomfort_flags: [], // no actual body discomfort — scan only
      last_scan_result: 'below_baseline',
      last_scan_hours_ago: 1,
      scan_type: 'hip_mobility',
    },
  },
  expected_priority_domain: 'mobility',
  expected_priority_effort: 'light',
  expected_readiness: 'medium',
  expected_rationale_contains: ['scan', 'hip'],
};

/**
 * Scenario D — Missed-three-days Friday
 * Readiness: medium | Priority domain: cardio | Effort: light
 */
export const scenarioD: ScenarioFixture = {
  user_id: 'sienna',
  seed_signals: [
    {
      signal_type: 'readiness_tap',
      payload: { readiness: 'neutral' },
      hours_ago: 0,
      occurred_at: new Date().toISOString(),
    },
  ],
  user_model_overrides: {
    recent_behavior_json: {
      sessions_completed_7d: 0,
      sessions_skipped_7d: 3,
      domains_touched_7d: [],
      last_session_card_id: null,
      last_session_hours_ago: null,
      avg_sleep_hours_7d: 6.0,
      stress_level: 'medium',
    },
    latest_situation_json: {
      readiness: 'neutral',
      latest_mood: null,
      time_context: 'afternoon',
    },
    constraints_json: {
      discomfort_areas: [],
      medical_context_tags: [],
    },
    latest_body_state_json: {
      discomfort_flags: [],
      last_scan_result: null,
      last_scan_hours_ago: null,
      scan_type: null,
    },
  },
  expected_priority_domain: 'cardio',
  expected_priority_effort: 'light',
  expected_readiness: 'medium',
  expected_rationale_contains: ['reset', 'rhythm'],
};

export const ALL_SCENARIOS = {
  A: scenarioA,
  B: scenarioB,
  C: scenarioC,
  D: scenarioD,
} as const;

export type ScenarioKey = keyof typeof ALL_SCENARIOS;
