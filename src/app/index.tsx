/**
 * Home screen — anchor route for the PR scoreboard.
 *
 * Web: sets document <title> via expo-router/head so axe document-title
 * violation is satisfied. Two nested React.Profilers accumulate render counts
 * into window.__SCOREBOARD_RENDER_COUNTS__ for the Playwright perf suite.
 * The Profiler callbacks fire synchronously during the commit phase; the
 * useEffect writes the totals after the first commit settles.
 * The window write is web-only and stripped by the React Compiler on native.
 */

import Head from 'expo-router/head';
import { Profiler, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  // Accumulate Profiler render counts in a stable ref — mutated synchronously
  // during each commit phase before the useEffect below reads the totals.
  const renderCounts = useRef({ leaf: 0, container: 0 });

  // onRender is compatible with ProfilerOnRenderCallback; only `id` is needed.
  const onRender = (id: string): void => {
    if (id === 'leaf') renderCounts.current.leaf += 1;
    if (id === 'container') renderCounts.current.container += 1;
  };

  // After first commit settles, publish measured totals so Playwright can read them.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ = {
        leaf: renderCounts.current.leaf,
        container: renderCounts.current.container,
      };
    }
  }, []);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Aaptiv Functional Feed</title>
          <meta name="description" content="Aaptiv Functional Feed scaffold — home screen" />
        </Head>
      )}
      <Profiler id="container" onRender={onRender}>
        <Profiler id="leaf" onRender={onRender}>
          <View style={styles.container}>
            <Text style={styles.heading} accessibilityRole="header">
              Aaptiv Functional Feed
            </Text>
            <Text style={styles.sub}>Scaffold is live — performance budgets enforced.</Text>
          </View>
        </Profiler>
      </Profiler>
    </>
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
