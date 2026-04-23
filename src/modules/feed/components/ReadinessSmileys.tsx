import React from 'react';
/**
 * ReadinessSmileys — the three readiness tap inputs per spec §12.6.
 *
 * On tap: fires POST /signals/ingest with the readiness signal.
 * The feed recomposes via the recomposition animation (~800ms total).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ReadinessSmileysProps {
  current: 'happy' | 'neutral' | 'sad';
  onTap: (readiness: 'happy' | 'neutral' | 'sad') => void;
}

const SMILEYS: Array<{
  value: 'happy' | 'neutral' | 'sad';
  emoji: string;
  label: string;
}> = [
  { value: 'happy', emoji: '😊', label: 'Feeling good' },
  { value: 'neutral', emoji: '😐', label: 'Okay' },
  { value: 'sad', emoji: '😔', label: 'Tired or off' },
];

export function ReadinessSmileys({ current, onTap }: ReadinessSmileysProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How are you feeling?</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Readiness">
        {SMILEYS.map(({ value, emoji, label }) => (
          <Pressable
            key={value}
            style={[styles.smiley, current === value && styles.smileyActive]}
            onPress={() => onTap(value)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: current === value }}
          >
            <Text style={[styles.emoji, current === value && styles.emojiActive]}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  smiley: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smileyActive: {
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  emoji: {
    fontSize: 26,
    opacity: 0.7,
  },
  emojiActive: {
    opacity: 1,
  },
});
