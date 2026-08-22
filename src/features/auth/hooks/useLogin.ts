// Hook custom pour la logique de connexion email OU téléphone.
// Détecte le type d'identifiant via regex, choisit le bon credential Supabase,
// puis redirige vers /feed après succès.
//
// Ticket E2-01 — Sprint 1 Auth & Onboarding (login screen).
// Ticket E2-03 — Sprint 1 Auth & Onboarding (email/phone + session SecureStore).

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  createLoginSchema,
  getLoginIdentifierType,
  normalizePhoneIdentifier,
  type LoginFormValues,
} from '../schemas/loginSchema';

export function useLogin() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loginSchema = useMemo(() => createLoginSchema(t.auth.validation), [t]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const submitLogin = async (values: LoginFormValues) => {
    const t = getT();
    setIsLoading(true);
    setLoginError(null);

    try {
      const identifierType = getLoginIdentifierType(values.identifier);
      const identifier = values.identifier.trim();

      if (!identifierType) {
        setLoginError(t.auth.errors.invalidIdentifier);
        return;
      }

      const credentials =
        identifierType === 'email'
          ? { email: identifier.toLowerCase(), password: values.password }
          : { phone: normalizePhoneIdentifier(identifier), password: values.password };

      logger.debug('Tentative de connexion', { type: identifierType });

      const { error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        logger.warn('Échec de connexion Supabase', { message: error.message });
        setLoginError(mapAuthError(error.message));
        return;
      }

      logger.info('Connexion réussie');
      router.replace('/feed');
    } catch (err: unknown) {
      logger.error('Erreur inattendue lors du login', err);
      setLoginError(t.auth.errors.unknown);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    loginError,
    onSubmit: form.handleSubmit(submitLogin),
  };
}
