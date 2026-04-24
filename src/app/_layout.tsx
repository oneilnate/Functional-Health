/**
 * Root layout — sets document title here (not in index.tsx)
 * to avoid expo-router/head SSR issue where useIsFocused() returns false
 * at screen level and produces an empty <title> a11y violation.
 *
 * Wraps the entire app in QueryClientProvider so all food/ (and future)
 * React Query hooks work without additional setup in child routes.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale data is acceptable for 30 s before refetching on window focus
      staleTime: 30_000,
      // Retry once on transient errors; food pod status polling handles its own retry
      retry: 1,
    },
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
