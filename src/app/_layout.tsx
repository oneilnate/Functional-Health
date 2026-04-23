import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Head from 'expo-router/head';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Set title at layout level so expo-router helmet SSR captures it.
          index.tsx's Head is skipped when useIsFocused()===false in SSR. */}
      <Head>
        <title>Functional Health</title>
      </Head>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
