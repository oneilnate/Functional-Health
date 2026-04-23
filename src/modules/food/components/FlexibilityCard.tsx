/**
 * FlexibilityCard — static black card showing flexibility score.
 * Matches IMG_5116/5117: dark background, 72% score, +5% this week.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function FlexibilityCard(): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.subtitle}>
        See where you stand with your flexibility and range of motion
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>72%</Text>
          <Text style={styles.statLabel}>SCORE</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>+5%</Text>
          <Text style={styles.statLabel}>THIS WEEK</Text>
        </View>
        <TouchableOpacity style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111111',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  subtitle: {
    color: '#CCCCCC',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333333',
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statItem: {
    gap: 2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  viewButton: {
    marginLeft: 'auto',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
