/**
 * UnlockedCard — shown when capturedCount >= DEMO_TARGET.
 * Matches IMG_5117: gray card, green "UNLOCKED" tag, right arrow.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UnlockedCardProps {
  onPress: () => void;
}

export function UnlockedCard({ onPress }: UnlockedCardProps): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.content}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>UNLOCKED</Text>
        </View>
        <Text style={styles.title}>Your FoodPod is Ready!</Text>
        <Text style={styles.subtitle}>View your personalized nutrition insights</Text>
      </View>
      <View style={styles.arrowButton}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  tag: {
    backgroundColor: '#22C55E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#555555',
    fontSize: 14,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
});
