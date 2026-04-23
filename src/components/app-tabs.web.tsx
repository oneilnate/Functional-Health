/**
 * Web tab layout — stripped down for Feed Decision Engine demo.
 *
 * Per acceptance criteria: remove "Expo Starter" branding, Docs tab,
 * and Explore tab. The feed owns the web export screen.
 *
 * The native app-tabs.tsx is unchanged (used for iOS/Android builds).
 */
import { TabSlot, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs>
      <View style={styles.container}>
        <TabSlot style={styles.slot} />
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  slot: {
    flex: 1,
  },
});
