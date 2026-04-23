/**
 * CoachingState contract — matches spec §8.5 verbatim.
 * This is the single contract every consumer reads.
 */

export type Domain =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'recovery'
  | 'breathing'
  | 'nutrition'
  | 'reflection';

export type EffortLevel = 'light' | 'moderate' | 'hard';

export type Readiness = 'high' | 'medium' | 'low';

/** Per-card rationale templates stored in card_catalog */
export interface RationaleTemplates {
  short: string[];
  expanded: string[];
}

/** A card from the seeded catalog */
export interface CatalogCard {
  card_id: string;
  domain: Domain;
  effort_level: EffortLevel;
  duration_min: number;
  title: string;
  equipment_required_json: string[];
  discomfort_contraindications_json: string[];
  rationale_templates_json: RationaleTemplates;
}

/** A materialized card — spec §8.5 FeedCard shape */
export interface FeedCard {
  card_id: string;
  domain: Domain;
  title: string;
  effort_level: EffortLevel;
  duration_min: number;
  rationale_short: string; // one sentence, rendered on card
  rationale_expanded: string; // 2-sentence "why" expansion
  audio_rationale_url: string | null; // v1.1; null in v1
  links_to_card_id: string | null; // cross-modality link
}

/** Full CoachingState — spec §8.5 verbatim */
export interface CoachingState {
  user_id: string;
  composed_at: string; // ISO timestamp
  readiness: Readiness;
  readiness_rationale: string; // one sentence, observational-warm
  daily_priority: FeedCard;
  supporting_cards: FeedCard[]; // exactly 3, engine-ranked
  cross_modality_note: string | null; // optional light narration on the priority
  adaptation_reasons: string[]; // what signals drove this composition
  shuffle_cooldown_until: string | null; // ISO timestamp
}

/** Five-layer user model */
export interface UserModel {
  user_id: string;
  segment: 'performance' | 'everyday' | 'tactical' | 'industrial' | 'medical_sensitive' | 'partner_custom';
  goals_json: GoalEntry[];
  preferences_json: UserPreferences;
  constraints_json: UserConstraints;
  recent_behavior_json: RecentBehavior;
  latest_body_state_json: BodyState;
  latest_situation_json: SituationState;
  updated_at: string;
}

export interface GoalEntry {
  goal: string;
  weight: number; // 0-1
}

export interface UserPreferences {
  gear: string[];
  movement_styles: string[];
  time_context: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface UserConstraints {
  discomfort_areas: string[];
  medical_context_tags: string[];
}

export interface RecentBehavior {
  sessions_completed_7d: number;
  sessions_skipped_7d: number;
  domains_touched_7d: Domain[];
  last_session_card_id: string | null;
  last_session_hours_ago: number | null;
  avg_sleep_hours_7d: number;
  stress_level: 'low' | 'medium' | 'high';
}

export interface BodyState {
  discomfort_flags: string[]; // body areas
  last_scan_result: string | null;
  last_scan_hours_ago: number | null;
  scan_type: string | null;
}

export interface SituationState {
  readiness: 'happy' | 'neutral' | 'sad';
  latest_mood: string | null;
  time_context: 'morning' | 'afternoon' | 'evening' | 'night';
}

/** Signal event types */
export type SignalType =
  | 'readiness_tap'
  | 'mood_tap'
  | 'session_completed'
  | 'session_skipped'
  | 'scan_updated'
  | 'discomfort_logged'
  | 'chat_adjustment';

export interface SignalEvent {
  signal_type: SignalType;
  payload: Record<string, unknown>;
  occurred_at?: string; // ISO; defaults to now
}

export interface SignalRequest {
  signal_type: SignalType;
  payload: Record<string, unknown>;
}

/** Scenario fixture shape — spec Appendix A.1 */
export interface ScenarioFixture {
  user_id: string;
  seed_signals: Array<SignalEvent & { hours_ago: number }>;
  user_model_overrides: Partial<Omit<UserModel, 'user_id' | 'updated_at'>>;
  expected_priority_domain: Domain;
  expected_priority_effort: EffortLevel;
  expected_readiness: Readiness;
  expected_rationale_contains: string[];
}
