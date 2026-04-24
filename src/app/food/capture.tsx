/**
 * Food Pod capture screen — /food/capture?podId=<id>
 *
 * Three-step upload flow per photo:
 *   1. useCreateMeal → presigned URL + mealId
 *   2. useUploadMealImage → PUT photo bytes to presigned URL
 *   3. usePatchMeal → mark meal as 'uploaded'
 *
 * Thumbnail strip shows per-photo status: spinner / checkmark / retry.
 * "Generate my podcast" enabled once ≥1 meal is uploaded.
 *
 * Architecture contract:
 * - JSX + local state only — no fetch(), no business logic
 * - All API work via hooks from src/modules/food/
 * - expo-image-picker for camera
 * - Performance budget: ≤3 renders on mount (leaf screen)
 */

import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCompletePod, useCreateMeal, usePatchMeal, useUploadMealImage } from '@/modules/food';

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = 'uploading' | 'uploaded' | 'error';

type MealEntry = {
  key: string;
  localUri: string;
  mealId: string | null;
  status: UploadStatus;
  errorMessage: string | null;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CaptureScreen() {
  const { podId } = useLocalSearchParams<{ podId: string }>();
  const router = useRouter();

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const keyCounter = useRef(0);

  const createMeal = useCreateMeal(podId ?? '');
  const uploadImage = useUploadMealImage();
  const patchMeal = usePatchMeal();
  const completePod = useCompletePod();

  // ─── 3-step upload flow ────────────────────────────────────────────────

  const runUploadFlow = useCallback(
    async (entryKey: string, localUri: string) => {
      try {
        // Step 1: register meal → presigned URL + mealId
        const { mealId, uploadUrl } = await createMeal.mutateAsync(undefined);

        setMeals((prev) => prev.map((m) => (m.key === entryKey ? { ...m, mealId } : m)));

        // Step 2: read file as blob and PUT to presigned URL (no bearer header)
        const fileResponse = await fetch(localUri);
        const fileBlob = await fileResponse.blob();
        await uploadImage.mutateAsync({ uploadUrl, fileBlob });

        // Step 3: mark meal as uploaded
        await patchMeal.mutateAsync(mealId);

        setMeals((prev) =>
          prev.map((m) =>
            m.key === entryKey ? { ...m, mealId, status: 'uploaded', errorMessage: null } : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setMeals((prev) =>
          prev.map((m) =>
            m.key === entryKey ? { ...m, status: 'error', errorMessage: message } : m,
          ),
        );
      }
    },
    [createMeal, uploadImage, patchMeal],
  );

  // ─── Camera tap ────────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    if (!podId) {
      Alert.alert('Error', 'No pod ID. Please go back and start a new pod.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Allow camera access in Settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const localUri = result.assets[0].uri;
    keyCounter.current += 1;
    const key = `meal-${keyCounter.current}`;

    const newEntry: MealEntry = {
      key,
      localUri,
      mealId: null,
      status: 'uploading',
      errorMessage: null,
    };

    setMeals((prev) => [...prev, newEntry]);
    void runUploadFlow(key, localUri);
  }, [podId, runUploadFlow]);

  // ─── Retry a failed upload ─────────────────────────────────────────────

  const handleRetry = useCallback(
    (entry: MealEntry) => {
      setMeals((prev) =>
        prev.map((m) =>
          m.key === entry.key ? { ...m, status: 'uploading', errorMessage: null } : m,
        ),
      );
      void runUploadFlow(entry.key, entry.localUri);
    },
    [runUploadFlow],
  );

  // ─── Generate podcast ──────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (!podId) return;
    completePod.mutate(podId, {
      onSuccess: () => {
        router.replace(`/food/pod/${podId}`);
      },
    });
  }, [podId, completePod, router]);

  // ─── Derived state ────────────────────────────────────────────────────

  const uploadedCount = meals.filter((m) => m.status === 'uploaded').length;
  const canGenerate = uploadedCount >= 1 && !completePod.isPending;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Counter */}
      <View style={styles.headerSection}>
        <Text style={styles.counter}>
          {meals.length === 0
            ? 'No photos yet — take your first!'
            : `${uploadedCount} of ${meals.length} photos uploaded`}
        </Text>
      </View>

      {/* Thumbnail strip */}
      {meals.length > 0 && (
        <ScrollView
          horizontal
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          showsHorizontalScrollIndicator={false}
        >
          {meals.map((entry) => (
            <View key={entry.key} style={styles.thumbnail}>
              <Image source={{ uri: entry.localUri }} style={styles.thumbnailImage} />
              {entry.status === 'uploading' && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {entry.status === 'uploaded' && (
                <View style={[styles.overlay, styles.overlaySuccess]}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
              {entry.status === 'error' && (
                <Pressable
                  style={[styles.overlay, styles.overlayError]}
                  onPress={() => handleRetry(entry)}
                  accessibilityLabel="Retry photo upload"
                  accessibilityRole="button"
                >
                  <Text style={styles.retryIcon}>↺</Text>
                  <Text style={styles.retryLabel}>Retry</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Big camera CTA */}
      <Pressable
        style={styles.cameraButton}
        onPress={handleTakePhoto}
        accessibilityLabel="Take a photo of your meal"
        accessibilityRole="button"
      >
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.cameraButtonText}>Take a photo of your meal</Text>
      </Pressable>

      {/* Bottom bar — generate */}
      <View style={styles.bottomBar}>
        {completePod.isError && (
          <Text style={styles.errorText}>
            {completePod.error?.message ?? 'Generation failed. Please try again.'}
          </Text>
        )}
        <Pressable
          style={[styles.generateButton, !canGenerate && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate}
          accessibilityLabel="Generate my podcast"
          accessibilityRole="button"
        >
          {completePod.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate my podcast</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const THUMBNAIL_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  counter: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  strip: {
    flexGrow: 0,
    height: THUMBNAIL_SIZE + 16,
  },
  stripContent: {
    paddingHorizontal: 24,
    gap: 10,
    alignItems: 'center',
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlaySuccess: {
    backgroundColor: 'rgba(34,197,94,0.70)',
  },
  overlayError: {
    backgroundColor: 'rgba(239,68,68,0.80)',
  },
  checkmark: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  retryIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  retryLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  cameraButton: {
    flex: 1,
    marginHorizontal: 24,
    marginVertical: 20,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraIcon: {
    fontSize: 48,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 8,
  },
  generateButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
  },
});
