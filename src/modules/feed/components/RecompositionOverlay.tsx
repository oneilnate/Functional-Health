import React from 'react';
/**
 * RecompositionOverlay — the "updating recommendations" blur overlay.
 *
 * Per spec §12.4: the priority card blurs for ~300ms with this overlay
 * while the new state loads, then settles over ~500ms.
 * Total animation: ~800ms.
 */
import { Animated, StyleSheet, Text } from 'react-native';
import type { AnimationPhase } from '../hooks/useFeed';

interface RecompositionOverlayProps {
  phase: AnimationPhase;
  isShuffle?: boolean;
}

export function RecompositionOverlay({ phase, isShuffle = false }: RecompositionOverlayProps) {
  if (phase === 'idle') return null;

  const message = isShuffle ? 'Finding other options…' : 'Updating recommendations…';

  return (
    <Animated.View style={styles.overlay} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  text: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
