/**
 * DailyPriorityCard — spec §12.2
 * Visually dominant card with title, effort tag, rationale line.
 * Subtle "why" button (bottom-right, 32x32, 60% opacity).
 * Shuffle button at card corner.
 * Recomposition animation: 300ms blur → swap → 500ms settle.
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedCard } from '@/engine/types';

interface DailyPriorityCardProps {
  card: FeedCard;
  crossModalityNote: string | null;
  onOpen: (cardId: string) => void;
  onWhy: (cardId: string) => void;
  onShuffle: () => void;
  shuffleEnabled: boolean;
  shuffleCooldownLabel: string | null;
  isRecomposing: boolean;
}

const DOMAIN_ACCENT: Record<string, string> = {
  strength: '#1D4ED8',
  cardio: '#DC2626',
  mobility: '#7C3AED',
  recovery: '#0E7490',
  breathing: '#065F46',
  nutrition: '#B45309',
  reflection: '#6B7280',
};

export function DailyPriorityCard({
  card,
  crossModalityNote: _crossModalityNote,
  onOpen,
  onWhy,
  onShuffle,
  shuffleEnabled,
  shuffleCooldownLabel,
  isRecomposing,
}: DailyPriorityCardProps) {
  const blurAnim = useRef(new Animated.Value(0)).current;
  const settleAnim = useRef(new Animated.Value(1)).current;
  const prevCardIdRef = useRef<string>(card.card_id);

  useEffect(() => {
    if (isRecomposing) {
      // Phase 1: blur 300ms
      Animated.timing(blurAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (card.card_id !== prevCardIdRef.current) {
      // Phase 2: content swapped, settle 500ms
      prevCardIdRef.current = card.card_id;
      blurAnim.setValue(0);
      settleAnim.setValue(0);
      Animated.timing(settleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isRecomposing, card.card_id, blurAnim, settleAnim]);

  const accent = DOMAIN_ACCENT[card.domain] ?? '#6B7280';

  // Blur: use opacity as visual substitute on React Native
  const opacity = Animated.add(
    Animated.multiply(blurAnim, 0.3), // blur → 30% opacity
    Animated.multiply(
      Animated.add(new Animated.Value(1), Animated.multiply(blurAnim, -1)),
      settleAnim,
    ),
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { opacity, borderTopColor: accent, borderTopWidth: 4 }]}>
        {/* Updating overlay during recomposition */}
        {isRecomposing ? (
          <View style={styles.updatingOverlay}>
            <Text style={styles.updatingText}>updating recommendations</Text>
          </View>
        ) : null}

        {/* Domain badge */}
        <View style={[styles.domainBadge, { backgroundColor: accent }]}>
          <Text style={styles.domainBadgeText}>{card.domain.toUpperCase()}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{card.title}</Text>

        {/* Meta row: effort + duration */}
        <View style={styles.metaRow}>
          <View style={[styles.effortBadge, { borderColor: accent }]}>
            <Text style={[styles.effortText, { color: accent }]}>
              {card.effort_level.charAt(0).toUpperCase() + card.effort_level.slice(1)}
            </Text>
          </View>
          <Text style={styles.durationText}>{card.duration_min} min</Text>
        </View>

        {/* Short rationale */}
        <Text style={styles.rationaleShort}>{card.rationale_short}</Text>

        {/* Action row: Open + Shuffle */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.openButton}
            onPress={() => onOpen(card.card_id)}
            accessibilityRole="button"
            accessibilityLabel={`Start ${card.title}`}
          >
            <Text style={styles.openButtonText}>Start</Text>
          </Pressable>

          <Pressable
            style={[styles.shuffleButton, !shuffleEnabled && styles.shuffleButtonDisabled]}
            onPress={shuffleEnabled ? onShuffle : undefined}
            accessibilityRole="button"
            accessibilityLabel={
              shuffleEnabled
                ? 'Shuffle recommendations'
                : `Shuffle available ${shuffleCooldownLabel ?? 'soon'}`
            }
            disabled={!shuffleEnabled}
          >
            <Text style={[styles.shuffleText, !shuffleEnabled && styles.shuffleTextDisabled]}>
              {shuffleEnabled ? 'Shuffle' : (shuffleCooldownLabel ?? 'Shuffle')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Why button — bottom-right of card, subtle */}
      <Pressable
        style={styles.whyButton}
        onPress={() => onWhy(card.card_id)}
        accessibilityRole="button"
        accessibilityLabel="Why this recommendation?"
      >
        <Text style={styles.whyButtonText}>?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    minHeight: 170,
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  updatingText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  domainBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 10,
  },
  domainBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  effortBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  effortText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  rationaleShort: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  shuffleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shuffleButtonDisabled: {
    opacity: 0.45,
  },
  shuffleText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  shuffleTextDisabled: {
    color: '#6B7280',
  },
  whyButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  whyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});
