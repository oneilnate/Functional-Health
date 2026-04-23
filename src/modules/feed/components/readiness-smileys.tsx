/**
 * ReadinessSmileys — three smiley inputs that fire /signals/ingest.
 * Spec §12.6: readiness smileys post to signals/ingest on tap.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReadinessTapPayload } from '@/engine/types';

type ReadinessValue = 'happy' | 'neutral' | 'sad';

interface ReadinessSmileysProps {
  currentReadiness: ReadinessValue;
  onTap: (readiness: ReadinessValue) => void;
}

const SMILEYS: Array<{ value: ReadinessValue; emoji: string; label: string }> = [
  { value: 'happy', emoji: '😊', label: 'Feeling good' },
  { value: 'neutral', emoji: '😐', label: 'Feeling okay' },
  { value: 'sad', emoji: '😔', label: 'Feeling tired' },
];

export function ReadinessSmileys({ currentReadiness, onTap }: ReadinessSmileysProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How are you feeling?</Text>
      <View style={styles.row}>
        {SMILEYS.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.smiley, currentReadiness === s.value && styles.smileySelected]}
            onPress={() => onTap(s.value)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
          >
            <Text style={styles.emoji}>{s.emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Type used by parent to construct the signal payload
export type { ReadinessTapPayload };

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 24,
  },
  smiley: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  smileySelected: {
    borderColor: '#111827',
    backgroundColor: '#F3F4F6',
  },
  emoji: {
    fontSize: 26,
  },
});
