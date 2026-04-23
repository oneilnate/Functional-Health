/**
 * FoodSnapCard — main food snapping card.
 * Matches IMG_5116: white card, fork icon, camera button, dot grid, recent snaps.
 */
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PodData } from '@/services/food.service';
import { GRID_SIZE } from '../constants';
import { DotGrid } from './DotGrid';
import { UnlockedCard } from './UnlockedCard';

interface FoodSnapCardProps {
  pod: PodData | undefined;
  capturedCount: number;
  onCapture: () => void;
  onUnlockedPress: () => void;
  isUploading: boolean;
  demoTarget: number;
}

// Placeholder meal images for recent snaps (display-only per spec)
const PLACEHOLDER_SNAPS = [
  {
    id: '1',
    uri: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200',
    thumbsUp: true,
  },
  {
    id: '2',
    uri: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200',
    thumbsUp: false,
  },
  {
    id: '3',
    uri: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200',
    thumbsUp: true,
  },
  {
    id: '4',
    uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200',
    thumbsUp: true,
  },
];

export function FoodSnapCard({
  capturedCount,
  onCapture,
  onUnlockedPress,
  isUploading,
  demoTarget,
}: FoodSnapCardProps): React.JSX.Element {
  const snaps = PLACEHOLDER_SNAPS;

  return (
    <View style={styles.card}>
      {/* Header row: fork icon + title + camera button */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <View style={styles.forkIcon}>
            <Text style={styles.forkEmoji}>🍴</Text>
          </View>
          <Text style={styles.title}>Food Snap</Text>
        </View>
        <View style={styles.cameraBlock}>
          <TouchableOpacity
            style={[styles.cameraButton, isUploading && styles.cameraButtonUploading]}
            onPress={onCapture}
            disabled={isUploading}
            accessibilityLabel="Capture meal photo"
          >
            <Text style={styles.cameraIcon}>📷</Text>
          </TouchableOpacity>
          <Text style={styles.counter}>
            {capturedCount}/{GRID_SIZE}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>
        {'Snap '}
        <Text style={styles.bold}>{GRID_SIZE}</Text>
        {' meals to unlock your personalized '}
        <Text style={styles.bold}>FoodPod</Text>
        {' with nutrition insights and meal ideas.'}
      </Text>

      {/* Dot grid */}
      <View style={styles.gridContainer}>
        <DotGrid capturedCount={capturedCount} />
      </View>

      {/* Unlocked card (conditional) */}
      {capturedCount >= demoTarget && <UnlockedCard onPress={onUnlockedPress} />}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Recent snaps */}
      <Text style={styles.recentLabel}>RECENT SNAPS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.snapScroll}>
        {snaps.map((snap) => (
          <View key={snap.id} style={styles.snapItem}>
            <Image source={{ uri: snap.uri }} style={styles.snapImage} />
            <View style={[styles.thumbBadge, snap.thumbsUp ? styles.thumbUp : styles.thumbDown]}>
              <Text style={styles.thumbEmoji}>{snap.thumbsUp ? '👍' : '👎'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  forkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forkEmoji: {
    fontSize: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  cameraBlock: {
    alignItems: 'center',
    gap: 4,
  },
  cameraButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonUploading: {
    opacity: 0.7,
  },
  cameraIcon: {
    fontSize: 24,
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  description: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
    color: '#000000',
  },
  gridContainer: {
    marginBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginVertical: 16,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 12,
  },
  snapScroll: {
    marginHorizontal: -4,
  },
  snapItem: {
    marginHorizontal: 4,
    position: 'relative',
  },
  snapImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbUp: {
    backgroundColor: '#1A1A1A',
  },
  thumbDown: {
    backgroundColor: '#1A1A1A',
  },
  thumbEmoji: {
    fontSize: 13,
  },
});
