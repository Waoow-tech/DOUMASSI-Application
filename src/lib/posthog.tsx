// Wrapper PostHog — ticket E1-14.
// Si EXPO_PUBLIC_POSTHOG_KEY est absent, retourne les enfants directement
// sans wrapper PostHogProvider — analytics désactivée silencieusement.

import { PostHogProvider } from 'posthog-react-native';
import type { ReactNode } from 'react';

import { env } from './env';

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  if (!env.EXPO_PUBLIC_POSTHOG_KEY) {
    if (__DEV__) {
      console.warn('[PostHog] API key absente — analytics désactivée');
    }
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={env.EXPO_PUBLIC_POSTHOG_KEY}
      options={{
        host: env.EXPO_PUBLIC_POSTHOG_HOST,
        // Capture auto les screens et touches en prod uniquement
        enableSessionReplay: !__DEV__,
      }}
      autocapture
    >
      {children}
    </PostHogProvider>
  );
}
