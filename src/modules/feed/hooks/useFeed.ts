/**
 * useFeed — manages the coaching state, signals, shuffle, and animation.
 * Per AGENTS.md: business logic lives in modules, not screens.
 */

import type { CoachingState, ScenarioKey } from '@fh/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFeedToday,
  fetchWhyCard,
  loadDemoScenario,
  postShuffle,
  postSignal,
} from '@/services/feed.service';

export type AnimationPhase = 'idle' | 'updating' | 'settling';

export interface UseFeedResult {
  state: CoachingState | null;
  animationPhase: AnimationPhase;
  whyText: string | null;
  whyCardId: string | null;
  shuffleCooldownRemaining: number; // seconds remaining, 0 = enabled
  loadScenario: (key: ScenarioKey) => void;
  sendReadinessTap: (readiness: 'happy' | 'neutral' | 'sad') => void;
  requestShuffle: () => void;
  openWhy: (cardId: string) => void;
  closeWhy: () => void;
}

export function useFeed(): UseFeedResult {
  const [state, setState] = useState<CoachingState | null>(null);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [whyText, setWhyText] = useState<string | null>(null);
  const [whyCardId, setWhyCardId] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load feed on mount
  useEffect(() => {
    setState(fetchFeedToday());
  }, []);

  // Update cooldown countdown
  useEffect(() => {
    if (!state?.shuffle_cooldown_until) {
      setCooldownRemaining(0);
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      return;
    }

    const until = new Date(state.shuffle_cooldown_until).getTime();
    const update = (): void => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining === 0 && cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
      }
    };
    update();
    cooldownTimer.current = setInterval(update, 1000);
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, [state?.shuffle_cooldown_until]);

  /** Recomposition animation: blur 300ms → swap → settle 500ms (spec §12.4) */
  const animateAndSet = useCallback((newState: CoachingState): void => {
    setAnimationPhase('updating');
    setTimeout(() => {
      setState(newState);
      setAnimationPhase('settling');
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 500);
    }, 300);
  }, []);

  const loadScenarioFn = useCallback(
    (key: ScenarioKey): void => {
      const newState = loadDemoScenario(key);
      animateAndSet(newState);
    },
    [animateAndSet],
  );

  const sendReadinessTap = useCallback(
    (readiness: 'happy' | 'neutral' | 'sad'): void => {
      const newState = postSignal({ signal_type: 'readiness_tap', payload: { readiness } });
      animateAndSet(newState);
    },
    [animateAndSet],
  );

  const requestShuffle = useCallback((): void => {
    if (!state) return;
    const cooldownUntil = state.shuffle_cooldown_until;
    if (cooldownUntil && new Date(cooldownUntil) > new Date()) return;

    setAnimationPhase('updating');
    const newState = postShuffle(state.daily_priority.card_id);
    if (!newState) {
      setAnimationPhase('idle');
      return;
    }
    setTimeout(() => {
      setState(newState);
      setAnimationPhase('settling');
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 500);
    }, 400);
  }, [state]);

  const openWhy = useCallback((cardId: string): void => {
    const why = fetchWhyCard(cardId);
    setWhyText(why.rationale_expanded);
    setWhyCardId(cardId);
  }, []);

  const closeWhy = useCallback((): void => {
    setWhyText(null);
    setWhyCardId(null);
  }, []);

  return {
    state,
    animationPhase,
    whyText,
    whyCardId,
    shuffleCooldownRemaining: cooldownRemaining,
    loadScenario: loadScenarioFn,
    sendReadinessTap,
    requestShuffle,
    openWhy,
    closeWhy,
  };
}
