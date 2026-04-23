/**
 * UserModel management — creates and updates the five-layer user model.
 */
import type { SignalEvent, UserModel } from './types.ts';

/** Default Sienna user model for seeding */
export const SIENNA_BASE_USER_MODEL: UserModel = {
  user_id: 'sienna',
  segment: 'everyday',
  goals_json: [
    { goal: 'strength', weight: 0.5 },
    { goal: 'mobility', weight: 0.3 },
    { goal: 'recovery', weight: 0.2 },
  ],
  preferences_json: {
    gear: ['dumbbells', 'resistance_band'],
    movement_styles: ['strength', 'mobility', 'breathing'],
    time_context: 'morning',
  },
  constraints_json: {
    discomfort_areas: [],
    medical_context_tags: [],
  },
  recent_behavior_json: {
    sessions_completed_7d: 3,
    sessions_skipped_7d: 0,
    domains_touched_7d: ['strength', 'cardio'],
    last_session_card_id: 'strength_full_55min',
    last_session_hours_ago: 72,
    avg_sleep_hours_7d: 7.0,
    stress_level: 'low',
  },
  latest_body_state_json: {
    discomfort_flags: [],
    last_scan_result: null,
    last_scan_hours_ago: null,
    scan_type: null,
  },
  latest_situation_json: {
    readiness: 'happy',
    latest_mood: null,
    time_context: 'morning',
  },
  updated_at: new Date().toISOString(),
};

/** Apply a signal to produce a mutated user model */
export function applySignalToModel(model: UserModel, signal: SignalEvent): UserModel {
  const updated: UserModel = JSON.parse(JSON.stringify(model)) as UserModel;
  updated.updated_at = new Date().toISOString();

  switch (signal.signal_type) {
    case 'readiness_tap': {
      const p = signal.payload as { readiness?: string };
      if (p.readiness === 'happy' || p.readiness === 'neutral' || p.readiness === 'sad') {
        updated.latest_situation_json.readiness = p.readiness;
      }
      break;
    }
    case 'mood_tap': {
      const p = signal.payload as { mood?: string };
      if (p.mood) updated.latest_situation_json.latest_mood = p.mood;
      break;
    }
    case 'session_completed': {
      const p = signal.payload as { card_id?: string; duration_min?: number };
      updated.recent_behavior_json.sessions_completed_7d += 1;
      if (p.card_id) {
        updated.recent_behavior_json.last_session_card_id = p.card_id;
        updated.recent_behavior_json.last_session_hours_ago = 0;
      }
      break;
    }
    case 'session_skipped': {
      updated.recent_behavior_json.sessions_skipped_7d += 1;
      break;
    }
    case 'scan_updated': {
      const p = signal.payload as { scan_type?: string; result_json?: string; hours_ago?: number };
      updated.latest_body_state_json.last_scan_result = p.result_json ?? 'below_baseline';
      updated.latest_body_state_json.last_scan_hours_ago = p.hours_ago ?? 0;
      updated.latest_body_state_json.scan_type = p.scan_type ?? null;
      // Hip scan flags hips in constraints
      if (p.scan_type === 'hip_mobility') {
        if (!updated.constraints_json.discomfort_areas.includes('hip_mobility_scan')) {
          updated.constraints_json.discomfort_areas = [
            ...updated.constraints_json.discomfort_areas,
            'hip_mobility_scan',
          ];
        }
      }
      break;
    }
    case 'discomfort_logged': {
      const p = signal.payload as { area?: string; severity?: string };
      if (p.area && !updated.constraints_json.discomfort_areas.includes(p.area)) {
        updated.constraints_json.discomfort_areas = [
          ...updated.constraints_json.discomfort_areas,
          p.area,
        ];
        updated.latest_body_state_json.discomfort_flags = [
          ...updated.latest_body_state_json.discomfort_flags,
          p.area,
        ];
      }
      break;
    }
    case 'chat_adjustment':
      // Future: handle chat adjustments
      break;
  }

  return updated;
}

/** Build a user model for a scenario by applying overrides and seed signals */
export function buildScenarioModel(
  base: UserModel,
  overrides: Partial<Omit<UserModel, 'user_id' | 'updated_at'>>,
  signals: Array<SignalEvent & { hours_ago: number }>,
): UserModel {
  let model: UserModel = {
    ...base,
    ...overrides,
    goals_json: overrides.goals_json ?? base.goals_json,
    preferences_json: overrides.preferences_json ?? base.preferences_json,
    constraints_json: overrides.constraints_json ?? base.constraints_json,
    recent_behavior_json: overrides.recent_behavior_json ?? base.recent_behavior_json,
    latest_body_state_json: overrides.latest_body_state_json ?? base.latest_body_state_json,
    latest_situation_json: overrides.latest_situation_json ?? base.latest_situation_json,
    updated_at: new Date().toISOString(),
  };

  // Apply signals in chronological order (oldest first)
  const sorted = [...signals].sort((a, b) => b.hours_ago - a.hours_ago);
  for (const sig of sorted) {
    model = applySignalToModel(model, sig);
  }

  return model;
}
