/**
 * FeedScreen — the main coaching feed per spec §12.
 *
 * Per AGENTS.md: this component owns JSX + local state only.
 * All business logic lives in useFeed.
 */

import type { ScenarioKey } from '@fh/engine';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DailyPriorityCard,
  ReadinessBattery,
  ReadinessSmileys,
  RecompositionOverlay,
  ScenarioSwitcher,
  SupportingCard,
  useFeed,
  WhySheet,
} from '../index';

export function FeedScreen() {
  const {
    state,
    animationPhase,
    whyText,
    whyCardId,
    shuffleCooldownRemaining,
    loadScenario,
    sendReadinessTap,
    requestShuffle,
    openWhy,
    closeWhy,
  } = useFeed();

  const [currentScenario, setCurrentScenario] = useState<ScenarioKey | null>(null);
  const [readinessTap, setReadinessTap] = useState<'happy' | 'neutral' | 'sad'>('happy');
  const [showReadinessOverlay, setShowReadinessOverlay] = useState(false);
  const blurAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animationPhase === 'updating') {
      Animated.timing(blurAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (animationPhase === 'settling') {
      Animated.timing(blurAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [animationPhase, blurAnim]);

  if (!state) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading your coaching feed…</Text>
      </View>
    );
  }

  const handleScenarioSelect = (key: ScenarioKey): void => {
    setCurrentScenario(key);
    loadScenario(key);
    if (key === 'A') setReadinessTap('happy');
    else if (key === 'B') setReadinessTap('sad');
    else setReadinessTap('neutral');
  };

  const handleReadinessTap = (r: 'happy' | 'neutral' | 'sad'): void => {
    setReadinessTap(r);
    sendReadinessTap(r);
  };

  const crossModalityNote = state.cross_modality_note;
  const whyCardCrossModality =
    whyCardId === state.daily_priority.card_id ? crossModalityNote : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today</Text>
        <ReadinessBattery
          readiness={state.readiness}
          rationale={state.readiness_rationale}
          onTap={() => setShowReadinessOverlay(true)}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Priority with recomposition overlay */}
        <View style={styles.prioritySection}>
          <Animated.View style={{ opacity: blurAnim }}>
            <DailyPriorityCard
              card={state.daily_priority}
              crossModalityNote={crossModalityNote}
              onOpen={openWhy}
              onWhy={openWhy}
              onShuffle={requestShuffle}
              shuffleEnabled={shuffleCooldownRemaining === 0}
              shuffleCooldownSeconds={shuffleCooldownRemaining}
            />
          </Animated.View>
          <RecompositionOverlay phase={animationPhase} />
        </View>

        {/* Supporting cards */}
        <View style={styles.supportsSection}>
          <Text style={styles.sectionLabel}>Also today</Text>
          <View style={styles.supports}>
            {state.supporting_cards.map((card) => (
              <SupportingCard
                key={card.card_id}
                card={card}
                priorityCardId={state.daily_priority.card_id}
                onOpen={openWhy}
              />
            ))}
          </View>
        </View>

        {/* Readiness smileys — signal plumbing per spec §12.6 */}
        <ReadinessSmileys current={readinessTap} onTap={handleReadinessTap} />

        {/* Scenario switcher — dev mode for screenshots */}
        <ScenarioSwitcher current={currentScenario} onSelect={handleScenarioSelect} />

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Readiness rationale overlay */}
      {showReadinessOverlay && (
        <Pressable style={styles.rationaleOverlay} onPress={() => setShowReadinessOverlay(false)}>
          <View style={styles.rationaleCard}>
            <Text style={styles.rationaleTitle}>{state.readiness_rationale}</Text>
            <Text style={styles.rationaleDismiss}>Tap to close</Text>
          </View>
        </Pressable>
      )}

      {/* Why bottom sheet */}
      <WhySheet
        visible={whyText !== null}
        rationaleText={whyText}
        crossModalityNote={whyCardCrossModality ?? null}
        onDismiss={closeWhy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    fontSize: 15,
    color: '#9ca3af',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  prioritySection: {
    marginBottom: 24,
    position: 'relative',
  },
  supportsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  supports: {
    gap: 10,
  },
  bottomPad: {
    height: 40,
  },
  rationaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  rationaleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    maxWidth: 340,
    width: '100%',
  },
  rationaleTitle: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
  },
  rationaleDismiss: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
