// Hook custom pour la logique de connexion.
// Encapsule React Hook Form + Zod + appel Supabase.
// Ticket E2-01 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { loginSchema, type LoginFormValues } from '../schemas/loginSchema';

/**
 * Hook de connexion — gère le formulaire, la validation Zod,
 * et l'appel à Supabase signInWithPassword.
 *
 * Si le backend n'est pas prêt, on simule un délai réseau
 * et on log les identifiants en dev uniquement.
 */
export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      // Log les identifiants en dev pour le debug MVP
      logger.debug('Tentative de connexion', {
        identifier: values.identifier,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: values.identifier,
        password: values.password,
      });

      if (error) {
        logger.warn('Échec de connexion Supabase', {
          message: error.message,
        });
        setLoginError(error.message);
        return;
      }

      // Connexion réussie — redirection vers l'accueil
      logger.info('Connexion réussie');
      router.replace('/');
    } catch (err: unknown) {
      // Fallback si le backend n'est pas encore prêt :
      // simule un délai réseau et log l'erreur.
      logger.error('Erreur inattendue lors du login', err);
      setLoginError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    loginError,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
