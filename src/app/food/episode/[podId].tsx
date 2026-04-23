/**
 * FoodPod episode player — /food/episode/:podId
 * E5 stub: polls status every 3s, shows elapsed timer.
 * E5 will replace with full audio player.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { EpisodeData } from '@/services/food.service';
import { getEpisode } from '@/services/food.service';

export default function EpisodeScreen(): React.JSX.Element {
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll episode status every 3s
  useEffect(() => {
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const data = await getEpisode(podId ?? 'pod_demo_01');
        if (!cancelled) setEpisode(data);
      } catch {
        // Backend may not be deployed yet — ignore
      }
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [podId]);

  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');

  const isReady = episode?.status === 'ready';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>FoodPod</Text>
        {isReady ? (
          <Text style={styles.readyText}>FoodPod is ready — full player coming from E5</Text>
        ) : (
          <>
            <ActivityIndicator color="#22C55E" size="large" style={styles.spinner} />
            <Text style={styles.generatingText}>Generating your FoodPod...</Text>
            <Text style={styles.timer}>
              {minutes}:{seconds}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  spinner: {
    marginVertical: 8,
  },
  generatingText: {
    color: '#CCCCCC',
    fontSize: 18,
    textAlign: 'center',
  },
  timer: {
    color: '#22C55E',
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  readyText: {
    color: '#22C55E',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
});
