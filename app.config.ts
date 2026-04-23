/**
 * app.config.ts — Expo dynamic config.
 *
 * Replaces app.json to support per-environment overrides via eas.json envs.
 * EXPO_PUBLIC_* vars are injected at build time from eas.json build profile env
 * and are accessible in the app via process.env.EXPO_PUBLIC_*.
 *
 * Key env vars for Food Pod:
 *   EXPO_PUBLIC_API_BASE_URL      — Railway API URL (e.g. https://api.yourapp.railway.app)
 *   EXPO_PUBLIC_DEMO_BEARER_TOKEN — Shared single-user demo bearer token
 *
 * Phase 2: replace EXPO_PUBLIC_DEMO_BEARER_TOKEN with expo-secure-store + magic link.
 */
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Aaptiv Functional Feed',
  slug: 'aaptiv-functional-feed',
  version: '0.0.1',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'aaptivfeed',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.everbetter.aaptivfeed',
  },
  android: {
    package: 'com.everbetter.aaptivfeed',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
    title: 'Aaptiv Functional Feed',
  },
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
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  owner: 'nateoutsidethebox',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/28a85fb2-e56c-4a53-a398-0080b43414ea',
  },
  extra: {
    router: {},
    eas: {
      projectId: '28a85fb2-e56c-4a53-a398-0080b43414ea',
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
      demoBearerToken: process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN ?? '',
    },
  },
};

export default config;
