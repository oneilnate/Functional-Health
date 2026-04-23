/**
 * Home screen — Feed Decision Engine demo.
 *
 * Web: sets document <title>, constrains viewport to mobile width (≈375-414px)
 * centered on desktop per acceptance criteria. No Expo Starter scaffold chrome.
 * React.Profiler for scoreboard perf budget tracking.
 *
 * Per AGENTS.md: screens contain JSX + local state only.
 * All business logic lives in src/modules/feed/hooks/useFeed.
 */

import type { ScenarioKey } from '@fh/engine';
import Head from 'expo-router/head';
import { Profiler, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
} from '@/modules/feed';

export default function HomeScreen() {
  // Set document.title synchronously on web before any async operations.
  // This ensures axe's document-title check finds a non-empty title even
  // if react-helmet-async's SSR placeholder hasn't been hydrated yet.
  useLayoutEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Functional Health';
    }
  }, []);

  const renderCounts = useRef({ leaf: 0, container: 0 });
  const onRender = (id: string): void => {
    if (id === 'leaf') renderCounts.current.leaf += 1;
    if (id === 'container') renderCounts.current.container += 1;
  };
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ = {
        leaf: renderCounts.current.leaf,
        container: renderCounts.current.container,
      };
    }
  }, []);

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

  const [currentScenario, setCurrentScenario] = useState<ScenarioKey | null>('A');
  const [showRationale, setShowRationale] = useState(false);
  const blurOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadScenario('A');
  }, [loadScenario]);

  // Recomposition animation: 300ms blur + 500ms settle = ~800ms total (spec §12.4)
  useEffect(() => {
    if (animationPhase === 'updating') {
      Animated.timing(blurOpacity, { toValue: 0.4, duration: 300, useNativeDriver: true }).start();
    } else if (animationPhase === 'settling') {
      Animated.timing(blurOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [animationPhase, blurOpacity]);

  const handleScenarioSelect = (key: ScenarioKey): void => {
    setCurrentScenario(key);
    loadScenario(key);
  };

  const currentReadinessTap =
    state?.readiness === 'high' ? 'happy' : state?.readiness === 'low' ? 'sad' : 'neutral';

  return (
    <>
      {/* Head renders on both SSR and client — provides the title for expo-router's
          mixHeadComponentsWithStaticResults so the static HTML gets a non-empty
          <title data-rh="true"> prepended first. */}
      <Head>
        <title>Functional Health</title>
        <meta name="description" content="Feed Decision Engine — coaching feed demo" />
      </Head>
      {/* Mobile viewport wrapper — constrains to phone width on web, centered */}
      <View style={styles.webViewportOuter}>
        <Profiler id="container" onRender={onRender}>
          <Profiler id="leaf" onRender={onRender}>
            <View style={styles.root}>
              {/* Header — "Functional" brand + readiness battery */}
              <View style={styles.header}>
                <Text style={styles.appName}>Functional</Text>
                {state != null && (
                  <ReadinessBattery
                    readiness={state.readiness}
                    rationale={state.readiness_rationale}
                    onTap={() => setShowRationale(true)}
                  />
                )}
              </View>

              {/* Feed scroll */}
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {state != null ? (
                  <>
                    {/* Priority card with recomposition animation */}
                    <View style={styles.priorityWrapper}>
                      <Animated.View style={{ opacity: blurOpacity }}>
                        <DailyPriorityCard
                          card={state.daily_priority}
                          crossModalityNote={state.cross_modality_note}
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
                      <Text style={styles.sectionLabel}>Supporting</Text>
                      <View style={styles.supportsList}>
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
                    <ReadinessSmileys current={currentReadinessTap} onTap={sendReadinessTap} />

                    {state.adaptation_reasons.length > 0 && (
                      <View style={styles.adaptationRow}>
                        <Text style={styles.adaptationLabel}>
                          {state.adaptation_reasons.join(' · ')}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.loadingRow}>
                    <Text style={styles.loadingText}>Loading your feed…</Text>
                  </View>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>

              {/* Dev-mode scenario switcher — always shown for screenshots */}
              <ScenarioSwitcher current={currentScenario} onSelect={handleScenarioSelect} />

              {/* Readiness rationale overlay */}
              {showRationale && state != null && (
                <Pressable style={styles.rationaleOverlay} onPress={() => setShowRationale(false)}>
                  <View style={styles.rationaleCard}>
                    <Text style={styles.rationaleTitle}>Your Readiness</Text>
                    <Text style={styles.rationaleBody}>{state.readiness_rationale}</Text>
                  </View>
                </Pressable>
              )}

              {/* Why bottom sheet */}
              {whyCardId != null && (
                <WhySheet
                  visible={whyText != null}
                  rationaleText={whyText}
                  crossModalityNote={
                    state?.daily_priority.card_id === whyCardId
                      ? (state.cross_modality_note ?? null)
                      : null
                  }
                  onDismiss={closeWhy}
                />
              )}
            </View>
          </Profiler>
        </Profiler>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Mobile viewport: full height outer container centers the phone-width column on web
  webViewportOuter: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: '#f9fafb',
    width: '100%',
    // On web: phone-width column + card shadow per acceptance criteria
    ...Platform.select({
      web: {
        maxWidth: 414,
        minHeight: '100vh' as unknown as number,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        alignSelf: 'center',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.select({ ios: 56, default: 24 }),
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  rationaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  rationaleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  rationaleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  rationaleBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
});
