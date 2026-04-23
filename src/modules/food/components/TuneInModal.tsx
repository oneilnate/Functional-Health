/**
 * TuneInModal — full-screen dark modal matching IMG_5118.
 * Fork-circle icon, "Your FoodPod", body copy, white pill "Tune In" button, "Not Now" link.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { completePod } from '@/services/food.service';
import { DEMO_POD_ID } from '../constants';

interface TuneInModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function TuneInModal({ visible, onDismiss }: TuneInModalProps): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleTuneIn = async (): Promise<void> => {
    setLoading(true);
    try {
      await completePod(DEMO_POD_ID);
    } catch {
      // Ignore errors (backend may not be deployed yet)
    } finally {
      setLoading(false);
    }
    onDismiss();
    // Use RelativePathString cast — typed routes regenerate on next expo start
    router.push(`/food/episode/${DEMO_POD_ID}` as import('expo-router').RelativePathString);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Fork icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.forkEmoji}>🍴</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Your FoodPod</Text>

        {/* Body */}
        <Text style={styles.body}>
          Get personalized nutrition insights from your past 7 days of meals!
        </Text>
        <Text style={styles.bodySecondary}>
          A new FoodPod will be ready every Monday at midnight — we&apos;ll notify you!
        </Text>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Tune In button */}
        <TouchableOpacity
          style={styles.tuneInButton}
          onPress={handleTuneIn}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.tuneInText}>Tune In</Text>
          )}
        </TouchableOpacity>

        {/* Not Now */}
        <TouchableOpacity onPress={onDismiss} style={styles.notNowButton}>
          <Text style={styles.notNowText}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1A0A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forkEmoji: {
    fontSize: 40,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  body: {
    color: '#CCCCCC',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
  },
  bodySecondary: {
    color: '#888888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  spacer: {
    flex: 1,
  },
  tuneInButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  tuneInText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  notNowButton: {
    paddingVertical: 8,
  },
  notNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
