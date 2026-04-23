/**
 * ScenarioSwitcher — dev-mode scenario switcher for demo/screenshotting.
 *
 * Cycles through all 4 canonical Sienna scenarios.
 * Always shown in this build (web export target for screenshots).
 */

import type { ScenarioKey } from '@fh/engine';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ScenarioSwitcherProps {
  current: ScenarioKey | null;
  onSelect: (key: ScenarioKey) => void;
}

const SCENARIOS: Array<{
  key: ScenarioKey;
  label: string;
  description: string;
}> = [
  { key: 'A', label: 'A: Rested Tuesday', description: 'Happy readiness, 3 sessions in, sleep 7h' },
  { key: 'B', label: 'B: Tired + Knee', description: 'Sad readiness, knee flagged, sleep 5.5h' },
  { key: 'C', label: 'C: Post-Scan Hips', description: 'Neutral, hip mobility scan 1h ago' },
  { key: 'D', label: 'D: Missed 3 Days', description: 'Neutral, 3 skips, re-entry posture' },
];

export function ScenarioSwitcher({ current, onSelect }: ScenarioSwitcherProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>⚙ Demo Scenarios</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SCENARIOS.map(({ key, label, description }) => (
          <Pressable
            key={key}
            style={[styles.chip, current === key && styles.chipActive]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityLabel={`Load scenario ${label}`}
          >
            <Text style={[styles.chipLabel, current === key && styles.chipLabelActive]}>
              {label}
            </Text>
            <Text style={[styles.chipDesc, current === key && styles.chipDescActive]}>
              {description}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  heading: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 140,
  },
  chipActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#38bdf8',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  chipLabelActive: {
    color: '#0284c7',
  },
  chipDesc: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: 14,
  },
  chipDescActive: {
    color: '#0369a1',
  },
});
