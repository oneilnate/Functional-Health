/**
 * Root layout — sets document title here (not in index.tsx)
 * to avoid expo-router/head SSR issue where useIsFocused() returns false
 * at screen level and produces an empty <title> a11y violation.
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Head from 'expo-router/head';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {Platform.OS === 'web' && (
        <Head>
          <title>Functional Health</title>
          <meta name="description" content="Your daily coaching feed" />
        </Head>
      )}
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
