/**
 * RewardPointsFooter — black card with reward points.
 * Matches IMG_5116 bottom: large number, "Reward points", right arrow.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function RewardPointsFooter(): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.points}>3,122</Text>
        <Text style={styles.label}>Reward points</Text>
        <Text style={styles.sublabel}>Earn more to claim amazing prizes</Text>
      </View>
      <TouchableOpacity style={styles.arrowButton} accessibilityLabel="View rewards">
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  points: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  sublabel: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
});
