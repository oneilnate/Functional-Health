/**
 * Home screen — anchor route for the PR scoreboard.
 *
 * Web: sets document <title> via expo-router <Head> so axe document-title
 * violation is satisfied. React.Profiler exposes mount-time render counts
 * via window.__SCOREBOARD_RENDER_COUNTS__ for the Playwright perf suite.
 * The Profiler is a no-op in production; the window write is web-only.
 */

import Head from 'expo-router/head';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Render-count accumulators (reset per navigation in SPA mode)
let _leafRenders = 0;
const _containerRenders = 0;

const onRenderCallback: ProfilerOnRenderCallback = (_id, phase) => {
  if (phase === 'mount') {
    _leafRenders += 1;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ = {
        leaf: _leafRenders,
        container: _containerRenders,
      };
    }
  }
};

export default function HomeScreen() {
  return (
    <Profiler id="HomeScreen" onRender={onRenderCallback}>
      {Platform.OS === 'web' && (
        <Head>
          <title>Obvious Mobile</title>
          <meta name="description" content="Obvious Mobile scaffold — home screen" />
        </Head>
      )}
      <View style={styles.container}>
        <Text style={styles.heading} accessibilityRole="header">
          Obvious Mobile
        </Text>
        <Text style={styles.sub}>Scaffold is live — performance budgets enforced.</Text>
      </View>
    </Profiler>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  sub: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
