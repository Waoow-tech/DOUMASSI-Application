// Écran de callback OAuth — destination du deep link doumassi://auth/callback.
// Capte les tokens (access_token + refresh_token) du fragment de l'URL,
// établit la session Supabase, puis redirige vers l'accueil.
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

    const consumeUrl = async (url: string | null) => {
      if (!url || cancelled) return;

      const tokens = extractTokensFromUrl(url);
      if (!tokens) {
        logger.warn('Deep link auth/callback sans tokens valides', { url });
        if (!cancelled) {
          setErrorMessage(t.auth.google.callbackError);
          setTimeout(() => router.replace('/(auth)/login'), 1500);
        }
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (error) {
        logger.warn('setSession a échoué après callback OAuth', { message: error.message });
        if (!cancelled) {
          setErrorMessage(t.auth.google.callbackError);
          setTimeout(() => router.replace('/(auth)/login'), 1500);
        }
        return;
      }

      logger.info('Session établie après OAuth Google');
      if (!cancelled) {
        router.replace('/');
      }
    };

    // Cas 1 : l'app a été ouverte directement par le deep link (cold start)
    Linking.getInitialURL().then(consumeUrl);

    // Cas 2 : l'app était déjà en arrière-plan, le deep link arrive en cours
    const subscription = Linking.addEventListener('url', ({ url }) => consumeUrl(url));

    return () => {
      cancelled = true;
      subscription.remove();
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
