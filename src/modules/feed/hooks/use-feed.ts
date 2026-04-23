/**
 * useFeed — hook for fetching and managing CoachingState.
 * Called on app-open and on focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CoachingState, SignalEvent } from '@/engine/types';
import {
  fetchFeedToday,
  fetchShuffle,
  fetchWhyRationale,
  ingestSignal,
} from '@/services/feed.service';

export type FeedStatus = 'idle' | 'loading' | 'recomposing' | 'error';

export interface UseFeedResult {
  state: CoachingState | null;
  status: FeedStatus;
  error: string | null;
  refresh: () => Promise<void>;
  ingest: (signal: Omit<SignalEvent, 'occurred_at'>) => Promise<void>;
  shuffleFeed: () => Promise<void>;
  fetchWhy: (cardId: string) => Promise<{ rationale_expanded: string; audio_rationale_url: null }>;
  shuffleCooldownUntil: Date | null;
}

export function useFeed(): UseFeedResult {
  const [state, setState] = useState<CoachingState | null>(null);
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setStatus('loading');
    setError(null);
    try {
      const newState = await fetchFeedToday();
      if (mountedRef.current) {
        setState(newState);
        setStatus('idle');
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
        setStatus('error');
      }
    }
  }, []);

  const ingest = useCallback(async (signal: Omit<SignalEvent, 'occurred_at'>) => {
    if (!mountedRef.current) return;
    setStatus('recomposing');
    try {
      const newState = await ingestSignal(signal);
      if (mountedRef.current) {
        setState(newState);
        setStatus('idle');
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to ingest signal');
        setStatus('error');
      }
    }
  }, []);

  const shuffleFeed = useCallback(async () => {
    if (!state || !mountedRef.current) return;
    setStatus('recomposing');
    try {
      const newState = await fetchShuffle(state.daily_priority.card_id);
      if (mountedRef.current) {
        setState(newState);
        setStatus('idle');
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to shuffle feed');
        setStatus('error');
      }
    }
  }, [state]);

  const fetchWhy = useCallback(async (cardId: string) => {
    return fetchWhyRationale(cardId);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shuffleCooldownUntil = state?.shuffle_cooldown_until
    ? new Date(state.shuffle_cooldown_until)
    : null;

  return {
    state,
    status,
    error,
    refresh,
    ingest,
    shuffleFeed,
    fetchWhy,
    shuffleCooldownUntil,
  };
}
