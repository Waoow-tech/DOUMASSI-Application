// Wire-up Sentry — ticket E1-14.
// Init conditionnel : si EXPO_PUBLIC_SENTRY_DSN est absent du .env.local,
// Sentry n'est pas initialisé et les méthodes capture* sont des no-op.

import * as Sentry from '@sentry/react-native';

import { env } from './env';

let isInitialized = false;

export function initSentry(): void {
  if (!env.EXPO_PUBLIC_SENTRY_DSN) {
    if (__DEV__) {
      console.warn('[Sentry] DSN absent — monitoring crashes désactivé');
    }
    return;
  }

  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    debug: __DEV__,
    // En prod : 10% des transactions sampled. En dev : 0 (pas de bruit).
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    // Profiling désactivé en MVP (impact perf à mesurer Sprint 7)
    profilesSampleRate: 0,
  });

  isInitialized = true;
}

export function isSentryReady(): boolean {
  return isInitialized;
}

export { Sentry };
