/**
 * Feed Decision Engine — Core Types
 * Matches spec §8.5 verbatim.
 */

export type Readiness = 'high' | 'medium' | 'low';
export type Domain =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'recovery'
  | 'breathing'
  | 'nutrition'
  | 'reflection';
export type EffortLevel = 'light' | 'moderate' | 'hard';
export type SignalType =
  | 'readiness_tap'
  | 'mood_tap'
  | 'session_completed'
  | 'session_skipped'
  | 'scan_updated'
  | 'discomfort_logged'
  | 'chat_adjustment';

export interface FeedCard {
  card_id: string;
  domain: Domain;
  title: string;
  effort_level: EffortLevel;
  duration_min: number;
  rationale_short: string;
  rationale_expanded: string;
  audio_rationale_url: string | null;
  links_to_card_id: string | null;
}

export interface CoachingState {
  user_id: string;
  composed_at: string;
  readiness: Readiness;
  readiness_rationale: string;
  daily_priority: FeedCard;
  supporting_cards: FeedCard[];
  cross_modality_note: string | null;
  adaptation_reasons: string[];
  shuffle_cooldown_until: string | null;
}

export interface CatalogCard {
  card_id: string;
  domain: Domain;
  effort_level: EffortLevel;
  duration_min: number;
  title: string;
  equipment_required: string[];
  discomfort_contraindications: string[];
  rationale_templates: {
    short: string[];
    expanded: string[];
  };
  cross_modality_domains?: Domain[];
  goal_tags: string[];
}

export interface UserModel {
  user_id: string;
  segment: 'everyday' | 'performance' | 'tactical';
  goals: Array<{ tag: string; weight: number }>;
  preferences: {
    gear: string[];
    time_context?: 'morning' | 'afternoon' | 'evening';
  };
  constraints: {
    discomfort_areas: string[];
  };
  recent_behavior: {
    sessions_this_week: number;
    last_session_hours_ago: number;
    last_session_domain?: Domain;
    sessions_skipped_streak: number;
  };
  latest_body_state: {
    scan_flags: string[];
    discomfort_flags: string[];
  };
  latest_situation: {
    readiness: 'happy' | 'neutral' | 'sad';
    time_context?: 'morning' | 'afternoon' | 'evening';
    sleep_hours?: number;
  };
}

export type SignalType2 = SignalType;

export interface ReadinessTapPayload {
  readiness: 'happy' | 'neutral' | 'sad';
}
export interface SessionCompletedPayload {
  card_id: string;
  duration_min: number;
  effort_rating: number;
}
export interface SessionSkippedPayload {
  card_id: string;
  reason?: string;
}
export interface ScanUpdatedPayload {
  scan_type: string;
  result_json: Record<string, unknown>;
  flags?: string[];
}
export interface DiscomfortLoggedPayload {
  area: string;
  severity: 'mild' | 'moderate' | 'severe';
}
export interface ChatAdjustmentPayload {
  adjustment_type: string;
  adjustment_json: Record<string, unknown>;
}
export interface MoodTapPayload {
  mood: string;
}

export type SignalPayload =
  | ReadinessTapPayload
  | SessionCompletedPayload
  | SessionSkippedPayload
  | ScanUpdatedPayload
  | DiscomfortLoggedPayload
  | ChatAdjustmentPayload
  | MoodTapPayload;

export interface SignalEvent {
  signal_type: SignalType;
  payload: SignalPayload;
  occurred_at: string;
}

export interface EngineInput {
  user: UserModel;
  signals: SignalEvent[];
  now: string;
}

export interface ScenarioFixture {
  user_id: string;
  user_model: UserModel;
  seed_signals: Array<{
    signal_type: SignalType;
    payload: SignalPayload;
    hours_ago: number;
  }>;
  expected_priority_domain: Domain;
  expected_priority_effort: EffortLevel;
  expected_readiness: Readiness;
  expected_rationale_contains: string[];
}
