/**
 * UAHeader — Under Armour NEXT branded header.
 * Matches IMG_5116: hamburger menu left, UA NEXT logo center.
 * Uses text-based logo (no trademark imagery per repo rules).
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function UAHeader(): React.JSX.Element {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.menuButton} accessibilityLabel="Menu">
        <View style={styles.menuLine} />
        <View style={styles.menuLine} />
      </TouchableOpacity>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          {'⌒ '}
          <Text style={styles.nextText}>NEXT</Text>
          <Text style={styles.plusText}>+</Text>
        </Text>
      </View>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 22,
    height: 2,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  nextText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  plusText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
});
