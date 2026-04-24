/**
 * ReadinessSmileys — three smiley inputs that fire /signals/ingest.
 * Spec §12.6: readiness smileys post to signals/ingest on tap.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReadinessTapPayload } from '@/engine/types';

type ReadinessValue = 'happy' | 'neutral' | 'sad';

interface ReadinessSmileysProps {
  currentReadiness: ReadinessValue;
  onTap: (readiness: ReadinessValue) => void;
}

const SMILEYS: Array<{
  value: ReadinessValue;
  icon: 'emoticon-happy-outline' | 'emoticon-neutral-outline' | 'emoticon-sad-outline';
  label: string;
}> = [
  { value: 'happy', icon: 'emoticon-happy-outline', label: 'Feeling good' },
  { value: 'neutral', icon: 'emoticon-neutral-outline', label: 'Feeling okay' },
  { value: 'sad', icon: 'emoticon-sad-outline', label: 'Feeling tired' },
];

export function ReadinessSmileys({ currentReadiness, onTap }: ReadinessSmileysProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>How are you feeling today</Text>
      <View style={styles.row}>
        {SMILEYS.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.pill, currentReadiness === s.value && styles.pillSelected]}
            onPress={() => onTap(s.value)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
          >
            <MaterialCommunityIcons name={s.icon} size={30} color="#111827" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Type used by parent to construct the signal payload
export type { ReadinessTapPayload };

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  pill: {
    flex: 1,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F1F1F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: '#E5E5EA',
  },
});
