/**
 * useCamera — camera capture hook for FoodPod meal snapping.
 * Uses expo-image-picker (not expo-camera) to keep existing dep footprint.
 */

import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Requests camera permission then launches the camera.
 * Returns the local image URI on success, null on cancel or denied.
 */
export async function captureMeal(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert('Camera Access Required', 'Enable camera access in Settings to snap your meals.', [
      { text: 'OK' },
    ]);
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return asset.uri;
}
