/**
 * Food Pod home screen — /food
 *
 * Shows the current pod state and provides CTAs to start, continue, or view.
 *
 * Architecture contract:
 * - JSX + local state only — no fetch(), no business logic
 * - All mutations delegated to hooks from src/modules/food/
 * - All pod ID persistence via useFoodPodStore (React context)
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCreatePod } from '@/modules/food';
import { useFoodPodStore } from '@/store/food-pod.store';

export default function FoodHomeScreen() {
  const router = useRouter();
  const { currentPodId, phase, setCapturing } = useFoodPodStore();

  const createPod = useCreatePod();

  function handleStartNewPod() {
    createPod.mutate(undefined, {
      onSuccess: (pod) => {
        setCapturing(pod.id);
        router.push({ pathname: '/food/capture', params: { podId: pod.id } });
      },
    });
  }

  function handleContinueCapturing() {
    if (currentPodId) {
      router.push({ pathname: '/food/capture', params: { podId: currentPodId } });
    }
  }

  function handleViewPod() {
    if (currentPodId) {
      router.push(`/food/pod/${currentPodId}`);
    }
  }

  const isCapturing = phase === 'capturing';
  const isGeneratingOrReady = phase === 'generating' || phase === 'ready';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Pod</Text>
        <Text style={styles.subtitle}>
          Capture your meals and receive a personalised nutrition podcast.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            createPod.isPending && styles.buttonDisabled,
          ]}
          onPress={handleStartNewPod}
          disabled={createPod.isPending}
          accessibilityLabel="Start new food pod"
          accessibilityRole="button"
        >
          {createPod.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonTextPrimary}>Start new pod</Text>
          )}
        </Pressable>

        {createPod.isError && (
          <Text style={styles.errorText}>
            {createPod.error?.message ?? 'Failed to create pod. Tap to retry.'}
          </Text>
        )}

        {isCapturing && currentPodId && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleContinueCapturing}
            accessibilityLabel="Continue capturing meals"
            accessibilityRole="button"
          >
            <Text style={styles.buttonTextSecondary}>Continue capturing</Text>
          </Pressable>
        )}

        {isGeneratingOrReady && currentPodId && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleViewPod}
            accessibilityLabel="View your food pod"
            accessibilityRole="button"
          >
            <Text style={styles.buttonTextSecondary}>
              {phase === 'ready' ? 'View podcast' : 'View pod (generating…)'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonPrimary: {
    backgroundColor: '#22C55E',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonTextPrimary: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
});
