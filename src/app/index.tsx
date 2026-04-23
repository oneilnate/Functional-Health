/**
 * Home screen — Functional Health Feed
 *
 * Replaces the scaffold's static home screen with the coaching feed.
 * Scoreboard profiler hooks preserved for CI performance measurement.
 *
 * <Head> is placed in _layout.tsx to avoid expo-router/head's SSR issue
 * where useIsFocused() returns false at screen level (would produce empty title).
 */

import { useRouter } from 'expo-router';
import { Profiler, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedScreen } from '@/modules/feed';

export default function HomeScreen() {
  const renderCounts = useRef({ leaf: 0, container: 0 });
  const router = useRouter();

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

  return (
    <Profiler id="container" onRender={onRender}>
      <Profiler id="leaf" onRender={onRender}>
        <View style={styles.wrapper}>
          <FeedScreen showDevSwitcher />
          <Pressable
            style={styles.foodPodTile}
            onPress={() => router.push('/food')}
            accessibilityLabel="Food Pod — capture meals, get a nutrition podcast"
            accessibilityRole="button"
          >
            <Text style={styles.foodPodIcon}>🍽️</Text>
            <View style={styles.foodPodTextBlock}>
              <Text style={styles.foodPodTitle}>Food Pod</Text>
              <Text style={styles.foodPodSubtitle}>Capture meals · get a nutrition podcast</Text>
            </View>
            <Text style={styles.foodPodChevron}>›</Text>
          </Pressable>
        </View>
      </Profiler>
    </Profiler>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  foodPodTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  foodPodIcon: {
    fontSize: 28,
  },
  foodPodTextBlock: {
    flex: 1,
  },
  foodPodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  foodPodSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  foodPodChevron: {
    fontSize: 22,
    color: '#94A3B8',
  },
});
