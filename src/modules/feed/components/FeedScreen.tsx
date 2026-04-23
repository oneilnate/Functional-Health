import React from 'react';
/**
 * FeedScreen — the main coaching feed render per spec §12.
 *
 * Wired to /feed/today via useFeed hook.
 * Renders: ReadinessBattery + DailyPriorityCard + SupportingCards + ReadinessSmileys + ScenarioSwitcher.
 * Exported for use in src/app/index.tsx (screen file holds JSX + local state only).
 */

import type { CoachingState, FeedCard, ScenarioKey } from '@fh/engine';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { AnimationPhase } from '../hooks/useFeed';
import { DailyPriorityCard } from './DailyPriorityCard';
import { ReadinessBattery } from './ReadinessBattery';
import { ReadinessSmileys } from './ReadinessSmileys';
import { RecompositionOverlay } from './RecompositionOverlay';
import { ScenarioSwitcher } from './ScenarioSwitcher';
import { SupportingCard } from './SupportingCard';

interface FeedScreenProps {
  state: CoachingState | null;
  animationPhase: AnimationPhase;
  blurOpacity: Animated.Value;
  currentScenario: ScenarioKey | null;
  shuffleCooldownRemaining: number;
  onReadinessTap: () => void;
  onScenarioSelect: (key: ScenarioKey) => void;
  onSendReadinessTap: (readiness: 'happy' | 'neutral' | 'sad') => void;
  onShuffle: () => void;
  onWhy: (cardId: string) => void;
  onOpen: (cardId: string) => void;
}

export function FeedScreen({
  state,
  animationPhase,
  blurOpacity,
  currentScenario,
  shuffleCooldownRemaining,
  onReadinessTap,
  onScenarioSelect,
  onSendReadinessTap,
  onShuffle,
  onWhy,
  onOpen,
}: FeedScreenProps) {
  const currentReadinessTap =
    state?.readiness === 'high' ? 'happy' : state?.readiness === 'low' ? 'sad' : 'neutral';

  return (
    <View style={styles.feedContent}>
      {state != null ? (
        <>
          {/* Priority card with recomposition animation */}
          <View style={styles.priorityWrapper}>
            <Animated.View style={{ opacity: blurOpacity }}>
              <DailyPriorityCard
                card={state.daily_priority}
                crossModalityNote={state.cross_modality_note}
                onOpen={onOpen}
                onWhy={onWhy}
                onShuffle={onShuffle}
                shuffleEnabled={shuffleCooldownRemaining === 0}
                shuffleCooldownSeconds={shuffleCooldownRemaining}
              />
            </Animated.View>
            <RecompositionOverlay phase={animationPhase} />
          </View>

          {/* Supporting cards */}
          <View style={styles.supportsSection}>
            <Text style={styles.sectionLabel}>Supporting</Text>
            <View style={styles.supportsList}>
              {state.supporting_cards.map((card: FeedCard) => (
                <SupportingCard
                  key={card.card_id}
                  card={card}
                  priorityCardId={state.daily_priority.card_id}
                  onOpen={onOpen}
                />
              ))}
            </View>
          </View>

          {/* Readiness smileys — signal plumbing per spec §12.6 */}
          <ReadinessBattery
            readiness={state.readiness}
            rationale={state.readiness_rationale}
            onTap={onReadinessTap}
          />
          <ReadinessSmileys current={currentReadinessTap} onTap={onSendReadinessTap} />

          {state.adaptation_reasons.length > 0 && (
            <View style={styles.adaptationRow}>
              <Text style={styles.adaptationLabel}>{state.adaptation_reasons.join(' · ')}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Loading your feed…</Text>
        </View>
      )}

      {/* Dev-mode scenario switcher — always shown for demo */}
      <ScenarioSwitcher current={currentScenario} onSelect={onScenarioSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  feedContent: {
    flex: 1,
  },
  priorityWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  supportsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  supportsList: {
    gap: 8,
  },
  adaptationRow: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 8,
  },
  adaptationLabel: {
    fontSize: 10,
    color: '#d1d5db',
    fontStyle: 'italic',
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },
});
