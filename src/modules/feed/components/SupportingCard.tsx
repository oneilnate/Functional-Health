/**
 * SupportingCard — supporting card per spec §12.3.
 *
 * - ~100–120pt tall, stacked vertically
 * - Title and effort tag
 * - rationale_short — one line, muted contrast
 * - No "why" button (keeps density low, makes priority's "why" feel earned)
 * - Pairing affordance if links_to_card_id points to priority
 */

import type { FeedCard } from '@fh/engine';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface SupportingCardProps {
  card: FeedCard;
  priorityCardId: string;
  onOpen: (cardId: string) => void;
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

export function SupportingCard({ card, priorityCardId, onOpen }: SupportingCardProps) {
  const domainColor = DOMAIN_COLORS[card.domain] ?? '#6b7280';
  const isPaired = card.links_to_card_id === priorityCardId;

  return (
    <Pressable
      style={styles.card}
      onPress={() => onOpen(card.card_id)}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.effort_level} effort. ${card.duration_min} minutes.`}
    >
      {/* Pairing affordance */}
      {isPaired && (
        <View style={styles.pairingBadge}>
          <Text style={styles.pairingText}>↑ paired with today's priority</Text>
        </View>
      )}

      <View style={styles.row}>
        {/* Domain accent bar */}
        <View style={[styles.accentBar, { backgroundColor: domainColor }]} />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {card.title}
            </Text>
            <View style={[styles.effortBadge, { backgroundColor: `${domainColor}18` }]}>
              <Text style={[styles.effortText, { color: domainColor }]}>{card.effort_level}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.duration}>{card.duration_min} min</Text>
            <Text style={styles.domain}>{card.domain}</Text>
          </View>

          <Text style={styles.rationale} numberOfLines={2}>
            {card.rationale_short}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  pairingBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bae6fd',
  },
  pairingText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    minHeight: 100,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  effortBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  effortText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  duration: {
    fontSize: 12,
    color: '#6b7280',
  },
  domain: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  rationale: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
});
