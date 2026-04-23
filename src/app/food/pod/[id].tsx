/**
 * Food Pod wait/playback screen — /food/pod/:id
 *
 * Stub screen — content delivered by F4-E3.
 * Shows a "generating" state while the podcast pipeline runs.
 */

import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function PodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#22C55E" />
      <Text style={styles.heading}>Generating your podcast…</Text>
      <Text style={styles.sub}>Pod ID: {id}</Text>
      <Text style={styles.note}>Full playback screen coming in F4-E3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: '#64748B',
  },
  note: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
