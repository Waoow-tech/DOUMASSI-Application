// Écran de callback OAuth — filet de sécurité.
//
// En usage normal (depuis #124), ce screen n'est JAMAIS atteint :
//   useGoogleAuth utilise WebBrowser.openAuthSessionAsync qui intercepte
//   le redirect Supabase directement dans le browser in-app et retourne
//   l'URL au code sans passer par la couche deep link système.
//
// Mais on garde la route pour gérer les cas edge :
//   - L'user ouvre l'app pendant que le browser est ouvert → cold start avec
//     un deep link entrant
//   - WebBrowser plante / le browser système prend le relais
//
// Le screen tente de récupérer les tokens depuis l'URL initiale, sinon
// redirige vers welcome après un court délai.
//
// Ticket E2-05 (création) + #124 (refactor : devient juste un fallback).

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Spinner, Text, YStack } from 'tamagui';

import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

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
  const t = useTranslations();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const consumeUrl = async (url: string | null) => {
      if (!url || cancelled) return;

      const tokens = extractTokensFromUrl(url);
      if (!tokens) return;

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (cancelled) return;

      if (error) {
        logger.warn('Fallback setSession failed', { message: error.message });
        return;
      }

      router.replace('/feed');
    };

    Linking.getInitialURL().then((url) => void consumeUrl(url));
    const linkingSub = Linking.addEventListener('url', ({ url }) => void consumeUrl(url));

    // Filet de sécurité : si rien n'arrive dans 5s, retour Welcome
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      logger.warn('OAuth callback fallback timeout — redirect welcome');
      setErrorMessage(getT().auth.google.callbackError);
      setTimeout(() => router.replace('/(auth)/welcome'), 1500);
    }, 5_000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      linkingSub.remove();
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
