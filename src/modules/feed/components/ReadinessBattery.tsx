/**
 * ReadinessBattery — three-state readiness indicator in the header.
 *
 * States per spec §12.1:
 * - high: pulsing green stroke (1.2s cycle, 8% opacity swing)
 * - medium: static green stroke
 * - low: ~40% fill, warm amber stroke, no animation
 *
 * Labels: "Ready" (high), "Steady" (medium), "Light today" (low)
 */

import type { Readiness } from '@fh/engine';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface ReadinessBatteryProps {
  readiness: Readiness;
  rationale: string;
  onTap: () => void;
}

const COLORS = {
  high: '#22c55e', // green-500
  medium: '#22c55e', // green-500
  low: '#f59e0b', // amber-400
} as const;

const LABELS: Record<Readiness, string> = {
  high: 'Ready',
  medium: 'Steady',
  low: 'Light today',
};

export function ReadinessBattery({
  readiness,
  rationale: _rationale,
  onTap,
}: ReadinessBatteryProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const color = COLORS[readiness];

  useEffect(() => {
    if (readiness !== 'high') {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [readiness, pulseAnim]);

  return (
    <Pressable
      style={styles.container}
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={`Readiness: ${LABELS[readiness]}. Tap to learn more.`}
    >
      <Animated.View style={[styles.batteryWrapper, { opacity: pulseAnim }]}>
        {/* Battery body */}
        <View style={[styles.batteryBody, { borderColor: color }]}>
          {/* Fill */}
          <View
            style={[
              styles.fill,
              {
                backgroundColor: color,
                width: readiness === 'low' ? '40%' : '90%',
              },
            ]}
          />
        </View>
        {/* Battery cap */}
        <View style={[styles.batteryCap, { backgroundColor: color }]} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>{LABELS[readiness]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  batteryWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryBody: {
    width: 28,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    padding: 2,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        overflow: 'hidden',
      },
    }),
  },
  fill: {
    height: '100%',
    borderRadius: 1,
  },
  batteryCap: {
    width: 3,
    height: 6,
    borderRadius: 1,
    marginLeft: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
