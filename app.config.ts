import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.config.ts — dynamic Expo config.
 * app.json is used as the static base; this file adds dynamic plugin config
 * (especially expo-image-picker permissions) and the Backend API URL comment.
 *
 * Backend API URL (defaults to https://pear-sandbox.everbetter.com)
 * Set EXPO_PUBLIC_API_BASE_URL in eas.json env to override.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Aaptiv Functional Feed',
  slug: config.slug ?? 'aaptiv-functional-feed',
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos for meal capture.',
        cameraPermission: 'Allow $(PRODUCT_NAME) to use your camera to photograph meals.',
      },
    ],
  ],
});
