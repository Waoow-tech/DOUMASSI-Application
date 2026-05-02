// Écran de callback OAuth — destination du deep link doumassi://auth/callback.
// Capture les tokens (access_token + refresh_token) du fragment de l'URL,
// établit la session Supabase, puis redirige vers /feed.
//
// 3 stratégies en parallèle (la première qui réussit l'emporte) :
//   1) Linking.getInitialURL — cas cold start (l'app a été ouverte par le deep link)
//   2) Linking.addEventListener('url') — cas warm (l'app était déjà ouverte)
//   3) supabase.auth.onAuthStateChange — fallback si Supabase a quand même capté
//      la session via un autre mécanisme (rehydratation, refresh token, etc.)
//
// Timeout de 10s : si rien ne se passe, on retourne sur Welcome avec une erreur.
//
// Ticket E2-05 — Sprint 1 Auth & Onboarding.

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';

import { t } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

/**
 * Parse le fragment d'une URL deep link pour en extraire les tokens.
 * Format attendu : doumassi://auth/callback#access_token=XXX&refresh_token=YYY&...
 */
function extractTokensFromUrl(url: string): {
  accessToken: string;
  refreshToken: string;
} | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function AuthCallbackScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finishWithError = () => {
      if (cancelled) return;
      logger.warn('Auth callback failed — redirecting to welcome');
      setErrorMessage(t.auth.google.callbackError);
      setTimeout(() => {
        if (!cancelled) router.replace('/(auth)/welcome');
      }, 1500);
    };

    const finishWithSuccess = () => {
      if (cancelled) return;
      if (timeoutId) clearTimeout(timeoutId);
      logger.info('Auth callback success — redirecting to feed');
      router.replace('/feed');
    };

    const consumeUrl = async (url: string | null, source: string) => {
      logger.debug('Auth callback consume URL', { source, hasUrl: !!url });
      if (!url || cancelled) return;

      const tokens = extractTokensFromUrl(url);
      if (!tokens) {
        logger.debug('URL has no tokens (probably initial launch URL)', { url });
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (cancelled) return;

      if (error) {
        logger.warn('setSession failed', { message: error.message });
        finishWithError();
        return;
      }

      finishWithSuccess();
    };

    // Stratégie 1 : URL initiale (cold start)
    Linking.getInitialURL().then((url) => {
      void consumeUrl(url, 'getInitialURL');
    });

    // Stratégie 2 : URL entrante (warm)
    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      void consumeUrl(url, 'addEventListener');
    });

    // Stratégie 3 : auth state change (Supabase peut établir la session autrement)
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Auth state change in callback', { event, hasSession: !!session });
      if (cancelled || !session) return;
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        finishWithSuccess();
      }
    });

    // Timeout : si rien n'arrive dans 10s, on abandonne
    timeoutId = setTimeout(() => {
      finishWithError();
    }, 10_000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      linkingSub.remove();
      authSub.subscription.unsubscribe();
    };
  }, []);

  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      gap="$4"
      paddingHorizontal="$5"
    >
      {errorMessage ? (
        <Text fontSize={14} color="$danger" textAlign="center">
          {errorMessage}
        </Text>
      ) : (
        <>
          <Spinner size="large" color="$accentNeon" />
          <Text fontSize={14} color="$placeholderColor">
            {t.auth.google.callbackInProgress}
          </Text>
        </>
      )}
    </YStack>
  );
}
