/**
 * Feed Service — API client for the Feed Decision Engine.
 * In this Expo-only scaffold, the engine runs in-process.
 * All fetch calls are interceptable via MSW for testing.
 */
import { applySignal, compose, getWhyRationale, shuffle } from '@/engine/compose';
import type { CoachingState, SignalEvent, UserModel } from '@/engine/types';

const ENGINE_BASE = 'https://engine.functionalhealth.local';

// Sienna's demo user model — updated by signal ingestion
let currentUserModel: UserModel = {
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
    last_session_hours_ago: 72,
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

// In-memory store for coaching state snapshot
let latestState: CoachingState | null = null;

// GET /feed/today
export async function fetchFeedToday(): Promise<CoachingState> {
  const now = new Date().toISOString();
  const state = compose(currentUserModel, now);
  latestState = state;
  return state;
}

// POST /signals/ingest
export async function ingestSignal(
  signal: Omit<SignalEvent, 'occurred_at'>,
): Promise<CoachingState> {
  const fullSignal: SignalEvent = {
    ...signal,
    occurred_at: new Date().toISOString(),
  };
  currentUserModel = applySignal(currentUserModel, fullSignal);
  const now = new Date().toISOString();
  const state = compose(currentUserModel, now);
  latestState = state;
  return state;
}

// POST /feed/shuffle
export async function fetchShuffle(currentCardId: string): Promise<CoachingState> {
  const now = new Date().toISOString();
  const state = shuffle(currentUserModel, currentCardId, now);
  latestState = state;
  return state;
}

// GET /feed/why/:cardId
export async function fetchWhyRationale(cardId: string): Promise<{
  card_id: string;
  rationale_expanded: string;
  audio_rationale_url: null;
  composed_at: string;
}> {
  const now = new Date().toISOString();
  return getWhyRationale(cardId, currentUserModel, now);
}

// Reset to a specific scenario user model (for dev-mode scenario switcher)
export function setScenarioUserModel(model: UserModel): void {
  currentUserModel = JSON.parse(JSON.stringify(model)) as UserModel;
  latestState = null;
}

export function getCurrentUserModel(): UserModel {
  return currentUserModel;
}

export function getLatestState(): CoachingState | null {
  return latestState;
}

// Unused ENGINE_BASE kept for future HTTP migration
export { ENGINE_BASE };
