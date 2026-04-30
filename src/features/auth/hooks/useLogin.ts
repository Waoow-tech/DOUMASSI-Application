import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  getLoginIdentifierType,
  loginSchema,
  normalizePhoneIdentifier,
  type LoginFormValues,
} from '../schemas/loginSchema';

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

  const submitLogin = async (values: LoginFormValues) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const identifierType = getLoginIdentifierType(values.identifier);
      const identifier = values.identifier.trim();

      if (!identifierType) {
        setLoginError('Entrez un email ou un numéro de téléphone valide');
        return;
      }

      const credentials =
        identifierType === 'email'
          ? { email: identifier.toLowerCase(), password: values.password }
          : { phone: normalizePhoneIdentifier(identifier), password: values.password };

      const { error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        logger.warn('Échec de connexion Supabase', { message: error.message });
        setLoginError(error.message);
        return;
      }

      logger.info('Connexion réussie');
      router.replace('/');
    } catch (err: unknown) {
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
    onSubmit: form.handleSubmit(submitLogin),
  };
}
