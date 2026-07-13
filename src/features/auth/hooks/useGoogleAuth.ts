// Hook pour le flow OAuth Google.
// Utilise expo-web-browser (Chrome Custom Tabs sur Android, ASWebAuthenticationSession sur iOS)
// qui gère le round-trip OAuth de manière fiable, contrairement à Linking.openURL
// qui dépendait de Chrome Android pour suivre le redirect vers le custom scheme.
//
// Flow :
//   1. supabase.auth.signInWithOAuth({ skipBrowserRedirect: true }) → URL Google
//   2. WebBrowser.openAuthSessionAsync(url, redirectTo) → ouvre le browser in-app
//   3. WebBrowser détecte le redirect vers redirectTo, ferme le browser, retourne l'URL
//   4. On parse les tokens du fragment, on appelle setSession, on redirect /feed
//
// Ticket E2-05 (création) + #124 (fix Android Chrome deep link).

import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Doit matcher `scheme` dans app.json + l'allowlist Redirect URLs Supabase
// (Authentication → URL Configuration).
const OAUTH_REDIRECT_URL = 'doumassi://auth/callback';

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

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signIn = async () => {
    const t = getT();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      logger.debug('Tentative OAuth Google');

      // 1. Récupérer l'URL Google de consentement depuis Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URL,
          // skipBrowserRedirect: on gère manuellement l'ouverture via WebBrowser
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.warn('signInWithOAuth Google failed', { message: error.message });
        setErrorMessage(mapAuthError(error.message));
        return;
      }

      if (!data?.url) {
        logger.warn('Pas d’URL OAuth retournée par Supabase');
        setErrorMessage(t.auth.errors.unknown);
        return;
      }

      // 2. Ouvrir l'URL dans Chrome Custom Tabs (Android) / ASWebAuthenticationSession (iOS)
      // openAuthSessionAsync surveille le redirectTo et ferme automatiquement le browser
      // dès que la cible est atteinte (contrairement à Linking.openURL qui ne le détecte pas).
      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL);

      logger.debug('WebBrowser auth session result', { type: result.type });

      // L'user a fermé le browser sans terminer (cancel/dismiss)
      if (result.type !== 'success') {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          // Pas d'erreur affichée — l'user a juste annulé volontairement
          logger.info('OAuth Google annulé par l’utilisateur');
          return;
        }
        logger.warn('WebBrowser auth session non-success', { type: result.type });
        setErrorMessage(t.auth.google.callbackError);
        return;
      }

      // 3. Parser les tokens depuis l'URL retournée
      const tokens = extractTokensFromUrl(result.url);
      if (!tokens) {
        logger.warn('URL OAuth retour sans tokens', { url: result.url });
        setErrorMessage(t.auth.google.callbackError);
        return;
      }

      // 4. Établir la session Supabase
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (sessionError) {
        logger.warn('setSession failed après OAuth', { message: sessionError.message });
        setErrorMessage(t.auth.google.callbackError);
        return;
      }

      logger.info('OAuth Google success — redirect /feed');
      router.replace('/feed');
    } catch (err: unknown) {
      logger.error('Erreur inattendue OAuth Google', err);
      setErrorMessage(t.auth.errors.unknown);
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading, errorMessage };
}
