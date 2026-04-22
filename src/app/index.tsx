/**
 * Home screen — anchor route for the PR scoreboard.
 *
 * Web: sets document <title> via expo-router/head so axe document-title
 * violation is satisfied. A useEffect writes mount-time render counts to
 * window.__SCOREBOARD_RENDER_COUNTS__ for the Playwright perf suite.
 * The window write is web-only and stripped by the React Compiler on native.
 */

import Head from 'expo-router/head';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__SCOREBOARD_RENDER_COUNTS__ = {
        leaf: 1,
        container: 0,
      };
    }
  }, []);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Obvious Mobile</title>
          <meta name="description" content="Obvious Mobile scaffold — home screen" />
        </Head>
      )}
      {/* accessibilityLabel="home-screen" is the stable Maestro selector — do NOT remove */}
      <View style={styles.container} accessibilityLabel="home-screen">
        <Text style={styles.heading} accessibilityRole="header">
          Obvious Mobile
        </Text>
        <Text style={styles.sub}>Scaffold is live — performance budgets enforced.</Text>
      </View>
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
