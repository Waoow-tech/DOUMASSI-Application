// Hook pour le flow OAuth Google.
// Délègue à Supabase la génération de l'URL de consentement Google,
// ouvre cette URL dans le navigateur du téléphone, puis le retour est géré
// par le deep link doumassi://auth/callback (cf. app/auth/callback.tsx).
//
// Ticket E2-05 — Sprint 1 Auth & Onboarding.

import * as Linking from 'expo-linking';
import { useState } from 'react';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { t } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Doit matcher `scheme` dans app.json + l'allowlist Redirect URLs Supabase
// (Authentication → URL Configuration).
const OAUTH_REDIRECT_URL = 'doumassi://auth/callback';

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      logger.debug('Tentative OAuth Google');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URL,
          // skipBrowserRedirect: on gère manuellement l'ouverture du navigateur
          // car on est sur React Native (pas de redirection auto possible).
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        logger.warn('Erreur signInWithOAuth Google', { message: error.message });
        setErrorMessage(mapAuthError(error.message));
        return;
      }

      if (!data?.url) {
        logger.warn('Pas d’URL OAuth retournée par Supabase');
        setErrorMessage(t.auth.errors.unknown);
        return;
      }

      // Ouvre la page de consentement Google dans le navigateur du tél.
      // Après auth réussie, Google → Supabase callback → deep link doumassi://auth/callback
      const supported = await Linking.canOpenURL(data.url);
      if (!supported) {
        logger.warn('URL OAuth non supportée par le device');
        setErrorMessage(t.auth.errors.unknown);
        return;
      }

      await Linking.openURL(data.url);
    } catch (err: unknown) {
      logger.error('Erreur inattendue OAuth Google', err);
      setErrorMessage(t.auth.errors.unknown);
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading, errorMessage };
}
