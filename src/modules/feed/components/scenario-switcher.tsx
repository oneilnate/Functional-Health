/**
 * ScenarioSwitcher — dev-mode demo tool.
 * Allows switching between all 4 canonical Sienna scenarios.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { siennaUserModel } from '@/engine/fixtures/scenario-a-rested-tuesday';
import { scenarioBUserModel } from '@/engine/fixtures/scenario-b-tired-knee';
import { scenarioCUserModel } from '@/engine/fixtures/scenario-c-post-scan-hips';
import { scenarioDUserModel } from '@/engine/fixtures/scenario-d-missed-three-days';
import type { UserModel } from '@/engine/types';
import { setScenarioUserModel } from '@/services/feed.service';

interface ScenarioSwitcherProps {
  onScenarioChange: () => void;
}

const SCENARIOS: Array<{ label: string; model: UserModel; color: string; textColor: string }> = [
  // color = border accent; textColor = WCAG AA-safe text on white/F8FAFC
  { label: 'A: Rested Tue', model: siennaUserModel, color: '#22C55E', textColor: '#15803D' },
  { label: 'B: Tired+Knee', model: scenarioBUserModel, color: '#F59E0B', textColor: '#92400E' },
  { label: 'C: Post-Scan', model: scenarioCUserModel, color: '#7C3AED', textColor: '#5B21B6' },
  { label: 'D: Missed 3d', model: scenarioDUserModel, color: '#6B7280', textColor: '#374151' },
];

export function ScenarioSwitcher({ onScenarioChange }: ScenarioSwitcherProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Dev: Scenario</Text>
      <View style={styles.buttons}>
        {SCENARIOS.map((s) => (
          <Pressable
            key={s.label}
            style={[styles.button, { borderColor: s.color }]}
            onPress={() => {
              setScenarioUserModel(s.model);
              onScenarioChange();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Switch to scenario ${s.label}`}
          >
            <Text style={[styles.buttonText, { color: s.textColor }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 8,
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
