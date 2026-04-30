// Hook pour le flow "mot de passe oublié".
// Encapsule React Hook Form + Zod + appel Supabase resetPasswordForEmail.
// Ticket E2-04 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/schemas/passwordResetSchema';
import { t } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Deep link cible : doit matcher `scheme` dans app.json + redirect URLs autorisées
// dans Supabase Dashboard > Auth > URL Configuration.
const RESET_REDIRECT_URL = 'doumassi://reset-password';

export function useForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      logger.debug('Demande de reset password', { email: values.email });

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: RESET_REDIRECT_URL,
      });

      if (error) {
        logger.warn('Échec resetPasswordForEmail', { message: error.message });
        setErrorMessage(mapAuthError(error.message));
        return;
      }

      logger.info('Email de reset envoyé');
      setSuccessMessage(t.auth.forgotPassword.successMessage);
      form.reset();
    } catch (err: unknown) {
      logger.error('Erreur inattendue forgotPassword', err);
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
    onSubmit: form.handleSubmit(onSubmit),
  };
}
