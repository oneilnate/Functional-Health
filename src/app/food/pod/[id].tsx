/**
 * Food Pod wait/playback screen — /food/pod/:id
 *
 * Dual-mode screen:
 *   GENERATING: 5-stage progress UI that polls every 2 s via React Query.
 *   READY:      expo-av podcast player + scrolling synced transcript.
 *   FAILED:     Error state with a retry button.
 *
 * Architecture contract (AGENTS.md):
 * - JSX + local state only — no fetch(), no business logic
 * - All server state via hooks from src/modules/food/
 * - expo-av for audio playback
 * - Performance budget: ≤ 6 renders on mount (container screen)
 */

import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type PipelineStage,
  type TranscriptSegment,
  useCompletePod,
  usePodcast,
  usePodStatus,
} from '@/modules/food';

// ─── Stage config ─────────────────────────────────────────────────────────────

type StageConfig = {
  key: PipelineStage;
  label: string;
};

const STAGES: StageConfig[] = [
  { key: 'vision', label: 'Analyzing photos' },
  { key: 'grounding', label: 'Grounding nutrition' },
  { key: 'script', label: 'Writing your episode' },
  { key: 'tts', label: 'Recording' },
  { key: 'upload', label: 'Publishing' },
];

// ─── StageRow sub-component ───────────────────────────────────────────────────

type StageRowState = 'pending' | 'running' | 'complete' | 'failed';

type StageRowProps = {
  label: string;
  state: StageRowState;
};

function StageRow({ label, state }: StageRowProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'running') {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulseAnim]);

  const iconMap: Record<StageRowState, string> = {
    pending: '○',
    running: '◉',
    complete: '✓',
    failed: '✗',
  };

  const colorMap: Record<StageRowState, string> = {
    pending: '#94A3B8',
    running: '#22C55E',
    complete: '#22C55E',
    failed: '#EF4444',
  };

  return (
    <View style={stageStyles.row}>
      <Animated.Text
        style={[
          stageStyles.icon,
          { color: colorMap[state], opacity: state === 'running' ? pulseAnim : 1 },
        ]}
      >
        {iconMap[state]}
      </Animated.Text>
      <Text style={[stageStyles.label, state === 'running' && stageStyles.labelActive]}>
        {label}
      </Text>
    </View>
  );
}

const stageStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  icon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#64748B',
    flex: 1,
  },
  labelActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
});

// ─── Generating view ──────────────────────────────────────────────────────────

type StageStatusShape = Partial<Record<PipelineStage, { status: StageRowState }>>;

type GeneratingViewProps = {
  stageStatus: StageStatusShape;
};

function GeneratingView({ stageStatus }: GeneratingViewProps) {
  return (
    <View style={genStyles.container}>
      <ActivityIndicator size="large" color="#22C55E" style={genStyles.spinner} />
      <Text style={genStyles.heading}>Creating your podcast…</Text>
      <View style={genStyles.stageList}>
        {STAGES.map((stage) => {
          const info = stageStatus[stage.key];
          const state: StageRowState = (info?.status ?? 'pending') as StageRowState;
          return <StageRow key={stage.key} label={stage.label} state={state} />;
        })}
      </View>
    </View>
  );
}

const genStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  spinner: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 32,
    textAlign: 'center',
  },
  stageList: {
    gap: 4,
  },
});

// ─── Playback view ────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type PlaybackViewProps = {
  audioUrl: string;
  segments: TranscriptSegment[];
};

function PlaybackView({ audioUrl, segments }: PlaybackViewProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const transcriptRef = useRef<ScrollView>(null);
  const segmentYOffsets = useRef<Record<number, number>>({});

  // Load audio on mount, unload on unmount
  useEffect(() => {
    let mounted = true;

    async function loadAudio() {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          (status: AVPlaybackStatus) => {
            if (!mounted) return;
            if (status.isLoaded) {
              setCurrentTimeSec((status.positionMillis ?? 0) / 1000);
              setDurationSec((status.durationMillis ?? 0) / 1000);
              setIsPlaying(status.isPlaying);
            }
          },
        );
        if (!mounted) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setDurationSec((status.durationMillis ?? 0) / 1000);
          setIsLoaded(true);
        }
      } catch {
        // Audio load failed — controls stay disabled
      }
    }

    void loadAudio();

    return () => {
      mounted = false;
      const s = soundRef.current;
      if (s) {
        void s.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [audioUrl]);

  const handlePlayPause = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    if (isPlaying) {
      await s.pauseAsync();
    } else {
      await s.playAsync();
    }
  }, [isPlaying]);

  const handleSeekMs = useCallback(async (posMs: number) => {
    const s = soundRef.current;
    if (!s) return;
    await s.setPositionAsync(posMs);
  }, []);

  // Find active transcript segment
  const activeIndex = segments.findIndex(
    (seg) => currentTimeSec >= seg.startSec && currentTimeSec < seg.endSec,
  );

  // Auto-scroll transcript to keep the active segment in view
  useEffect(() => {
    if (activeIndex < 0) return;
    const y = segmentYOffsets.current[activeIndex];
    if (y !== undefined) {
      transcriptRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    }
  }, [activeIndex]);

  const progress = durationSec > 0 ? currentTimeSec / durationSec : 0;

  return (
    <View style={pbStyles.container}>
      {/* ── Player card ── */}
      <View style={pbStyles.playerCard}>
        <Text style={pbStyles.playerTitle}>Your Nutrition Podcast</Text>

        {/* Seek bar */}
        <View style={pbStyles.seekBarWrapper}>
          <View style={pbStyles.seekBarBg}>
            <View style={[pbStyles.seekBarFill, { flex: progress > 0 ? progress : 0 }]} />
            <View style={[pbStyles.seekBarEmpty, { flex: 1 - (progress > 0 ? progress : 0) }]} />
          </View>
        </View>

        {/* Time labels */}
        <View style={pbStyles.timeRow}>
          <Text style={pbStyles.timeText}>{formatTime(currentTimeSec)}</Text>
          <Text style={pbStyles.timeText}>{formatTime(durationSec)}</Text>
        </View>

        {/* Play / Pause button */}
        <Pressable
          style={[pbStyles.playButton, !isLoaded && pbStyles.buttonDisabled]}
          onPress={() => void handlePlayPause()}
          disabled={!isLoaded}
          accessibilityLabel={isPlaying ? 'Pause podcast' : 'Play podcast'}
          accessibilityRole="button"
        >
          <Text style={pbStyles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
      </View>

      {/* ── Transcript ── */}
      <ScrollView
        ref={transcriptRef}
        style={pbStyles.transcriptScroll}
        contentContainerStyle={pbStyles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {segments.map((seg, idx) => {
          const isActive = idx === activeIndex;
          return (
            <Pressable
              key={`seg-${seg.startSec}`}
              onLayout={(e) => {
                segmentYOffsets.current[idx] = e.nativeEvent.layout.y;
              }}
              style={[pbStyles.segmentRow, isActive && pbStyles.segmentActive]}
              onPress={() => void handleSeekMs(seg.startSec * 1000)}
              accessibilityLabel={`Seek to: ${seg.text.slice(0, 50)}`}
              accessibilityRole="button"
            >
              <Text style={[pbStyles.segmentText, isActive && pbStyles.segmentTextActive]}>
                {seg.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const pbStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  playerCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
    alignItems: 'center',
  },
  playerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  seekBarWrapper: {
    width: '100%',
    paddingVertical: 8,
  },
  seekBarBg: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  seekBarFill: {
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  seekBarEmpty: {
    backgroundColor: '#E2E8F0',
  },
  timeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  segmentRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  segmentActive: {
    backgroundColor: '#DCFCE7',
  },
  segmentText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  segmentTextActive: {
    color: '#166534',
    fontWeight: '500',
  },
});

// ─── Failed view ──────────────────────────────────────────────────────────────

type FailedViewProps = {
  onRetry: () => void;
  isPending: boolean;
  errorMessage: string | null;
};

function FailedView({ onRetry, isPending, errorMessage }: FailedViewProps) {
  return (
    <View style={failStyles.container}>
      <Text style={failStyles.icon}>⚠️</Text>
      <Text style={failStyles.heading}>Podcast generation failed</Text>
      {errorMessage !== null && <Text style={failStyles.detail}>{errorMessage}</Text>}
      <Pressable
        style={[failStyles.button, isPending && failStyles.buttonDisabled]}
        onPress={onRetry}
        disabled={isPending}
        accessibilityLabel="Retry podcast generation"
        accessibilityRole="button"
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={failStyles.buttonText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const failStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  icon: {
    fontSize: 48,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  detail: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});

// ─── Container screen ─────────────────────────────────────────────────────────

export default function PodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const podId = id ?? '';

  const { data: pod, isLoading } = usePodStatus(podId);
  const { data: podcast } = usePodcast(podId, pod?.status);
  const completePod = useCompletePod();

  const handleRetry = useCallback(() => {
    completePod.mutate(podId);
  }, [podId, completePod]);

  // Initial load splash
  if (isLoading && !pod) {
    return (
      <View style={rootStyles.loading}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  // Generating (also show for draft status to avoid blank screen)
  if (pod?.status === 'generating' || pod?.status === 'draft') {
    return <GeneratingView stageStatus={pod.stageStatus as StageStatusShape} />;
  }

  // Ready + podcast loaded → full playback
  if (pod?.status === 'ready' && podcast) {
    return <PlaybackView audioUrl={podcast.audioUrl} segments={podcast.transcript.segments} />;
  }

  // Ready but podcast fetch in-flight
  if (pod?.status === 'ready') {
    return (
      <View style={rootStyles.loading}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={rootStyles.loadingText}>Loading podcast…</Text>
      </View>
    );
  }

  // Failed
  if (pod?.status === 'failed') {
    return (
      <FailedView
        onRetry={handleRetry}
        isPending={completePod.isPending}
        errorMessage={completePod.error?.message ?? null}
      />
    );
  }

  // Fallback — no pod data yet
  return (
    <View style={rootStyles.loading}>
      <ActivityIndicator size="large" color="#22C55E" />
      <Text style={rootStyles.loadingText}>Loading…</Text>
      <Pressable
        style={rootStyles.backButton}
        onPress={() => router.back()}
        accessibilityLabel="Back to food home"
        accessibilityRole="button"
      >
        <Text style={rootStyles.backButtonText}>← Back</Text>
      </Pressable>
    </View>
  );
}

const rootStyles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748B',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 15,
    color: '#0EA5E9',
    fontWeight: '500',
  },
});
