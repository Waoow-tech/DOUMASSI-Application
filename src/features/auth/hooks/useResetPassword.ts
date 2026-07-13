// Hook pour la finalisation du reset password.
// 1) Capte le deep link entrant (doumassi://reset-password#access_token=...&refresh_token=...)
// 2) Établit la session Supabase avec ces tokens
// 3) Permet à l'utilisateur de soumettre un nouveau mot de passe via updateUser
//
// Ticket E2-04 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/passwordResetSchema';
import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

/**
 * Parse le fragment d'une URL deep link pour en extraire access_token + refresh_token.
 * Format attendu : doumassi://reset-password#access_token=XXX&refresh_token=YYY&type=recovery
 * Retourne null si l'un des tokens est manquant.
 */
function extractTokensFromUrl(url: string): {
  accessToken: string;
  refreshToken: string;
} | null {
  // Le fragment commence après '#', les query params après '?'.
  // Supabase utilise le fragment ('#') pour le flow PKCE/recovery.
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function useResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Capture le deep link au montage de l'écran : on lit l'URL initiale (cas où l'app
  // est ouverte par le lien) ET on s'abonne aux URLs entrantes (cas app déjà ouverte).
  useEffect(() => {
    let cancelled = false;

    const consumeUrl = async (url: string | null) => {
      if (!url || cancelled) return;
      const tokens = extractTokensFromUrl(url);
      if (!tokens) {
        logger.warn('Deep link reset-password sans tokens valides', { url });
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (error) {
        logger.warn('setSession a échoué après deep link', { message: error.message });
        if (!cancelled) setErrorMessage(getT().auth.resetPassword.invalidLink);
        return;
      }

      if (!cancelled) {
        logger.info('Session reset password établie via deep link');
        setHasValidSession(true);
      }
    };

    // Cas 1 : l'app a été ouverte directement par le lien
    Linking.getInitialURL().then(consumeUrl);

    // Cas 2 : l'app était déjà en arrière-plan, le lien arrive en cours de route
    const subscription = Linking.addEventListener('url', ({ url }) => consumeUrl(url));

    // Cas 3 : la session est déjà active (utilisateur déjà connecté ou navigation directe)
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setHasValidSession(true);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const t = getT();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        logger.warn('updateUser a échoué', { message: error.message });
        setErrorMessage(mapAuthError(error.message));
        return;
      }

      logger.info('Mot de passe modifié');
      setSuccessMessage(t.auth.resetPassword.successMessage);

      // Redirection vers login après une courte pause (laisse le succès s'afficher).
      setTimeout(() => {
        supabase.auth.signOut().finally(() => {
          router.replace('/(auth)/welcome');
        });
      }, 1500);
    } catch (err: unknown) {
      logger.error('Erreur inattendue resetPassword', err);
      setErrorMessage(t.auth.errors.unknown);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    errorMessage,
    successMessage,
    hasValidSession,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
