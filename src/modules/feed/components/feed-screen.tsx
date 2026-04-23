/**
 * FeedScreen — the main coaching feed.
 * Spec §12: wired to /feed/today, signal plumbing, recomposition animation.
 * Demo polish: mobile-viewport layout, no Expo starter chrome.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFeed } from '../hooks/use-feed';
import { DailyPriorityCard } from './daily-priority-card';
import { ReadinessBattery } from './readiness-battery';
import { ReadinessSmileys } from './readiness-smileys';
import { ScenarioSwitcher } from './scenario-switcher';
import { SupportingCard } from './supporting-card';
import { WhyBottomSheet } from './why-bottom-sheet';

interface FeedScreenProps {
  showDevSwitcher?: boolean;
}

export function FeedScreen({ showDevSwitcher = true }: FeedScreenProps) {
  const { state, status, error, refresh, ingest, shuffleFeed, fetchWhy, shuffleCooldownUntil } =
    useFeed();

  const [whySheetVisible, setWhySheetVisible] = useState(false);
  const [whyRationale, setWhyRationale] = useState('');
  const [whyCrossModalityNote, setWhyCrossModalityNote] = useState<string | null>(null);
  const [rationaleOverlayVisible, setRationaleOverlayVisible] = useState(false);
  const [cooldownLabel, setCooldownLabel] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isRecomposing = status === 'recomposing';
  const prevStateRef = useRef(state);

  // Track when cards change for supporting card fade-in
  const [changingCardIds, setChangingCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state && prevStateRef.current) {
      const prev = prevStateRef.current;
      const newChanging = new Set<string>();
      for (const sc of state.supporting_cards) {
        const wasPresent = prev.supporting_cards.some((c) => c.card_id === sc.card_id);
        if (!wasPresent) newChanging.add(sc.card_id);
      }
      prevStateRef.current = state;
      if (newChanging.size > 0) {
        setChangingCardIds(newChanging);
        const t = setTimeout(() => setChangingCardIds(new Set()), 200);
        return () => clearTimeout(t);
      }
      return undefined;
    }
    prevStateRef.current = state;
    return undefined;
  }, [state]);

  // Cooldown timer
  useEffect(() => {
    if (!shuffleCooldownUntil) {
      setCooldownLabel(null);
      return;
    }
    const update = () => {
      const ms = shuffleCooldownUntil.getTime() - Date.now();
      if (ms <= 0) {
        setCooldownLabel(null);
        return;
      }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setCooldownLabel(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [shuffleCooldownUntil]);

  const handleWhy = useCallback(
    async (cardId: string) => {
      const result = await fetchWhy(cardId);
      setWhyRationale(result.rationale_expanded);
      setWhyCrossModalityNote(state?.cross_modality_note ?? null);
      setWhySheetVisible(true);
    },
    [fetchWhy, state],
  );

  const handleReadinessTap = useCallback(
    async (readiness: 'happy' | 'neutral' | 'sad') => {
      await ingest({ signal_type: 'readiness_tap', payload: { readiness } });
    },
    [ingest],
  );

  const handleShuffle = useCallback(async () => {
    await shuffleFeed();
  }, [shuffleFeed]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleScenarioChange = useCallback(() => {
    void refresh();
  }, [refresh]);

  const shuffleEnabled = !shuffleCooldownUntil || shuffleCooldownUntil.getTime() <= Date.now();

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load feed</Text>
        <Pressable onPress={() => void refresh()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.phoneFrame}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor="#111827"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>Good morning, Sienna</Text>
            <Text style={styles.headerSub}>Here's your day.</Text>
          </View>
          {state ? (
            <Pressable onPress={() => setRationaleOverlayVisible(true)}>
              <ReadinessBattery
                readiness={state.readiness}
                rationale={state.readiness_rationale}
                onTap={() => setRationaleOverlayVisible(true)}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Readiness rationale overlay */}
        {rationaleOverlayVisible && state ? (
          <Pressable
            style={styles.rationaleOverlay}
            onPress={() => setRationaleOverlayVisible(false)}
          >
            <View style={styles.rationaleCard}>
              <Text style={styles.rationaleOverlayText}>{state.readiness_rationale}</Text>
              <Text style={styles.rationaleOverlayDismiss}>tap to dismiss</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Loading state */}
        {status === 'loading' && !state ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your feed…</Text>
          </View>
        ) : null}

        {state ? (
          <>
            {/* Section label */}
            <Text style={styles.sectionLabel}>Today's Priority</Text>

            {/* Daily priority card */}
            <DailyPriorityCard
              card={state.daily_priority}
              crossModalityNote={state.cross_modality_note}
              onOpen={(cardId) => {
                console.log('Starting card:', cardId);
              }}
              onWhy={(cardId) => void handleWhy(cardId)}
              onShuffle={() => void handleShuffle()}
              shuffleEnabled={shuffleEnabled}
              shuffleCooldownLabel={cooldownLabel}
              isRecomposing={isRecomposing}
            />

            {/* Supporting cards */}
            <Text style={styles.sectionLabel}>Supporting</Text>
            {state.supporting_cards.map((card) => (
              <SupportingCard
                key={card.card_id}
                card={card}
                isPairedWithPriority={card.links_to_card_id === state.daily_priority.card_id}
                isChanging={changingCardIds.has(card.card_id)}
              />
            ))}

            {/* Readiness smileys */}
            <ReadinessSmileys
              currentReadiness={
                (state.adaptation_reasons.find((r) => r.includes('readiness'))
                  ? state.readiness === 'high'
                    ? 'happy'
                    : state.readiness === 'low'
                      ? 'sad'
                      : 'neutral'
                  : 'neutral') as 'happy' | 'neutral' | 'sad'
              }
              onTap={(r) => void handleReadinessTap(r)}
            />

            {/* Dev scenario switcher */}
            {showDevSwitcher ? <ScenarioSwitcher onScenarioChange={handleScenarioChange} /> : null}
          </>
        ) : null}
      </ScrollView>

      {/* Why bottom sheet */}
      <WhyBottomSheet
        visible={whySheetVisible}
        rationaleExpanded={whyRationale}
        crossModalityNote={whyCrossModalityNote}
        onDismiss={() => setWhySheetVisible(false)}
      />
    </View>
  );
}

const PHONE_MAX_WIDTH = 390;

const styles = StyleSheet.create({
  phoneFrame: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rationaleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-start',
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  rationaleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  rationaleOverlayText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  rationaleOverlayDismiss: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'right',
  },
});
