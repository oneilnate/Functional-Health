/**
 * DailyPriorityCard — the dominant priority card per spec §12.2.
 *
 * - 160–200pt height, full visual, title and effort tag front-and-center
 * - One-sentence rationale in muted-contrast text
 * - Circular "why" button at bottom-right (32x32pt, 60% opacity until tapped)
 * - Shuffle button (pill-shaped) at top-right corner
 */

import type { FeedCard } from '@fh/engine';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface DailyPriorityCardProps {
  card: FeedCard;
  crossModalityNote: string | null;
  onOpen: (cardId: string) => void;
  onWhy: (cardId: string) => void;
  onShuffle: () => void;
  shuffleEnabled: boolean;
  shuffleCooldownSeconds: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  strength: '#3b82f6',
  cardio: '#ef4444',
  mobility: '#8b5cf6',
  recovery: '#06b6d4',
  breathing: '#10b981',
  nutrition: '#f59e0b',
  reflection: '#6366f1',
};

const EFFORT_LABELS: Record<string, string> = {
  light: 'Light',
  moderate: 'Moderate',
  hard: 'Hard',
};

export function DailyPriorityCard({
  card,
  crossModalityNote,
  onOpen,
  onWhy,
  onShuffle,
  shuffleEnabled,
  shuffleCooldownSeconds,
}: DailyPriorityCardProps) {
  const domainColor = DOMAIN_COLORS[card.domain] ?? '#6b7280';

  return (
    <View style={[styles.card, { borderLeftColor: domainColor, borderLeftWidth: 4 }]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.domainTag}>
          <Text style={[styles.domainText, { color: domainColor }]}>
            {card.domain.toUpperCase()}
          </Text>
        </View>
        {/* Shuffle button */}
        <Pressable
          style={[styles.shuffleButton, !shuffleEnabled && styles.shuffleButtonDisabled]}
          onPress={onShuffle}
          disabled={!shuffleEnabled}
          accessibilityRole="button"
          accessibilityLabel={
            shuffleEnabled
              ? 'Shuffle recommendations'
              : `Shuffle available in ${shuffleCooldownSeconds}s`
          }
        >
          <Text style={[styles.shuffleText, !shuffleEnabled && styles.shuffleTextDisabled]}>
            {shuffleEnabled ? '⇄ Shuffle' : `⇄ ${Math.ceil(shuffleCooldownSeconds / 60)}m`}
          </Text>
        </Pressable>
      </View>

      {/* Title */}
      <Text style={styles.title}>{card.title}</Text>

      {/* Effort + duration */}
      <View style={styles.metaRow}>
        <View style={[styles.effortBadge, { backgroundColor: `${domainColor}20` }]}>
          <Text style={[styles.effortText, { color: domainColor }]}>
            {EFFORT_LABELS[card.effort_level] ?? card.effort_level}
          </Text>
        </View>
        <Text style={styles.duration}>{card.duration_min} min</Text>
      </View>

      {/* Rationale — one sentence, muted */}
      <Text style={styles.rationale}>{card.rationale_short}</Text>

      {/* Cross-modality note */}
      {crossModalityNote != null && (
        <View style={styles.crossModalityRow}>
          <Text style={styles.crossModalityNote}>↓ {crossModalityNote}</Text>
        </View>
      )}

      {/* Why button */}
      <Pressable
        style={styles.whyButton}
        onPress={() => onWhy(card.card_id)}
        accessibilityRole="button"
        accessibilityLabel="Why this recommendation?"
      >
        <Text style={styles.whyText}>?</Text>
      </Pressable>

      {/* Full-card tap area — below buttons in z-order; hidden from a11y tree */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => onOpen(card.card_id)}
        accessible={false}
        importantForAccessibility="no"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  domainTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  domainText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  shuffleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  shuffleButtonDisabled: {
    opacity: 0.45,
  },
  shuffleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  shuffleTextDisabled: {
    color: '#6b7280',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  effortBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  effortText: {
    fontSize: 12,
    fontWeight: '600',
  },
  duration: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  rationale: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  crossModalityRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  crossModalityNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  whyButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  whyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
});
