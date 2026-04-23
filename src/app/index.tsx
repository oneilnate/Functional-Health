/**
 * Home screen — Functional Health Feed
 *
 * Replaces the scaffold's static home screen with the coaching feed.
 * Scoreboard profiler hooks preserved for CI performance measurement.
 *
 * <Head> is placed in _layout.tsx to avoid expo-router/head's SSR issue
 * where useIsFocused() returns false at screen level (would produce empty title).
 */
import { Profiler, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FeedScreen } from '@/modules/feed';

export default function HomeScreen() {
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

  return (
    <Profiler id="container" onRender={onRender}>
      <Profiler id="leaf" onRender={onRender}>
        <View style={styles.wrapper}>
          <FeedScreen showDevSwitcher />
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
});
