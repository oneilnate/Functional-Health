/**
 * food-pod.store.ts — Food Pod current-pod local state via React context.
 *
 * Holds the active podId so the food screens can share "which pod am I
 * working on" without prop-drilling. Server state (Pod shape, status)
 * lives in React Query; only the transient podId lives here.
 *
 * Architecture contract:
 * - No fetch() calls — client-only state
 * - No `any` types
 * - Named exports only
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

export type PodPhase = 'idle' | 'capturing' | 'generating' | 'ready';

type State = {
  currentPodId: string | null;
  phase: PodPhase;
};

type Action =
  | { type: 'SET_CAPTURING'; podId: string }
  | { type: 'SET_GENERATING' }
  | { type: 'SET_READY' }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CAPTURING':
      return { currentPodId: action.podId, phase: 'capturing' };
    case 'SET_GENERATING':
      return { ...state, phase: 'generating' };
    case 'SET_READY':
      return { ...state, phase: 'ready' };
    case 'RESET':
      return { currentPodId: null, phase: 'idle' };
    default:
      return state;
  }
}

const initialState: State = { currentPodId: null, phase: 'idle' };

type FoodPodContextValue = State & {
  setCapturing: (podId: string) => void;
  setGenerating: () => void;
  setReady: () => void;
  reset: () => void;
};

const FoodPodContext = createContext<FoodPodContextValue | null>(null);

export function FoodPodProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setCapturing = useCallback((podId: string) => {
    dispatch({ type: 'SET_CAPTURING', podId });
  }, []);

  const setGenerating = useCallback(() => {
    dispatch({ type: 'SET_GENERATING' });
  }, []);

  const setReady = useCallback(() => {
    dispatch({ type: 'SET_READY' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({ ...state, setCapturing, setGenerating, setReady, reset }),
    [state, setCapturing, setGenerating, setReady, reset],
  );

  return <FoodPodContext.Provider value={value}>{children}</FoodPodContext.Provider>;
}

export function useFoodPodStore(): FoodPodContextValue {
  const ctx = useContext(FoodPodContext);
  if (ctx === null) {
    throw new Error('useFoodPodStore must be used within a FoodPodProvider');
  }
  return ctx;
}
