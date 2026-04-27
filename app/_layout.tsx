// Root layout Expo Router — wrappe l'app avec tous les providers techniques.
// Voir CLAUDE.md §Stack technique figée.

import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { AnalyticsProvider } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';

import config from '../tamagui.config';

// Init Sentry au top du module (avant le premier render).
// No-op si EXPO_PUBLIC_SENTRY_DSN n'est pas défini.
initSentry();

// Garde le splash natif visible pendant le chargement des fonts
SplashScreen.preventAutoHideAsync().catch(() => {
  // En dev hot-reload, preventAutoHideAsync peut throw — non critique
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={config} defaultTheme="dark">
          <QueryClientProvider client={queryClient}>
            <AnalyticsProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#000000' },
                }}
              />
            </AnalyticsProvider>
          </QueryClientProvider>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
