/**
 * SupportingCard — spec §12.3
 * ~100-120pt tall, title, effort tag, rationale_short.
 * No "why" button on supporting cards (v1).
 * Optional pairing affordance when links_to_card_id points to the priority.
 */
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { FeedCard } from '@/engine/types';

interface SupportingCardProps {
  card: FeedCard;
  isPairedWithPriority: boolean;
  isChanging: boolean;
}

const DOMAIN_ACCENT: Record<string, string> = {
  strength: '#1D4ED8',
  cardio: '#DC2626',
  mobility: '#7C3AED',
  recovery: '#0891B2',
  breathing: '#059669',
  nutrition: '#D97706',
  reflection: '#6B7280',
};

export function SupportingCard({ card, isPairedWithPriority, isChanging }: SupportingCardProps) {
  const accent = DOMAIN_ACCENT[card.domain] ?? '#6B7280';

  return (
    <Animated.View
      style={[
        styles.card,
        isPairedWithPriority && styles.pairedCard,
        { opacity: isChanging ? 0.6 : 1 },
      ]}
    >
      {isPairedWithPriority ? (
        <View style={[styles.pairingBadge, { backgroundColor: accent }]}>
          <Text style={styles.pairingBadgeText}>✦ paired with today's priority</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={styles.rationaleShort} numberOfLines={2}>
            {card.rationale_short}
          </Text>
        </View>

        <View style={styles.metaColumn}>
          <View style={[styles.effortBadge, { borderColor: accent }]}>
            <Text style={[styles.effortText, { color: accent }]}>
              {card.effort_level.charAt(0).toUpperCase() + card.effort_level.slice(1)}
            </Text>
          </View>
          <Text style={styles.durationText}>{card.duration_min}m</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  pairedCard: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  pairingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
    opacity: 0.85,
  },
  pairingBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rationaleShort: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  metaColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  effortBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  effortText: {
    fontSize: 11,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
