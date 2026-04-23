/**
 * ReadinessBattery — three states per spec §12.1
 * high: pulsing green stroke (1.2s cycle)
 * medium: static green stroke
 * low: ~40% fill, warm amber stroke, no animation
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Readiness } from '@/engine/types';

interface ReadinessBatteryProps {
  readiness: Readiness;
  rationale: string;
  onTap: () => void;
}

const LABEL: Record<Readiness, string> = {
  high: 'Ready',
  medium: 'Steady',
  low: 'Light today',
};

const COLOR: Record<Readiness, string> = {
  high: '#22C55E',
  medium: '#22C55E',
  low: '#F59E0B',
};

export function ReadinessBattery({
  readiness,
  rationale: _rationale,
  onTap,
}: ReadinessBatteryProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (readiness === 'high') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.08 + 1, // 8% opacity swing mapped to scale
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [readiness, pulseAnim]);

  const fillPercent = readiness === 'low' ? 0.4 : 1;
  const color = COLOR[readiness];

  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={`Readiness: ${LABEL[readiness]}`}
      style={styles.container}
    >
      <Animated.View style={{ opacity: readiness === 'high' ? pulseAnim : 1 }}>
        <View style={[styles.battery, { borderColor: color }]}>
          <View style={styles.batteryNub} />
          <View
            style={[
              styles.batteryFill,
              {
                backgroundColor: color,
                width: `${fillPercent * 100}%`,
              },
            ]}
          />
        </View>
      </Animated.View>
      <Text style={[styles.label, { color }]}>{LABEL[readiness]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  battery: {
    width: 28,
    height: 14,
    borderWidth: 2,
    borderRadius: 3,
    justifyContent: 'center',
    padding: 1,
    position: 'relative',
  },
  batteryNub: {
    position: 'absolute',
    right: -5,
    top: '50%',
    marginTop: -3,
    width: 3,
    height: 6,
    backgroundColor: '#9CA3AF',
    borderRadius: 1,
  },
  batteryFill: {
    height: '100%',
    borderRadius: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
