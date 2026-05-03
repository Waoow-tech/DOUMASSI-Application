// Hook for signup logic (single page form).
// Uses mapAuthError for user-friendly error messages.
//
// Refactor E2-02b : suppression de la step 2 (avatar/bio/professional/gender)
// — ces champs sont désormais collectés dans l'onboarding.
// useAvatarPicker reste disponible et sera réutilisé dans E2-09.
//
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { signupSchema, type SignupFormValues } from '../schemas/signupSchema';

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      birthday: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  /**
   * Submit du signup. La création du compte Supabase écrit fullName, username
   * et birthday dans `raw_user_meta_data` ; un trigger SQL côté Supabase populera
   * la table `profiles` avec ces valeurs au moment de l'INSERT.
   *
   * Après succès, on redirige vers /feed. Le guard E2-07 verra que le profil
   * est éventuellement incomplet (pas d'avatar/cover/etc.) et enverra l'user
   * sur /onboarding pour finaliser.
   */
  const performSignup = async (values: SignupFormValues) => {
    setIsLoading(true);
    setSignupError(null);

    try {
      // Convert birthday DD/MM/YYYY → ISO YYYY-MM-DD
      const [day, month, year] = values.birthday.split('/');
      const birthdayISO = `${year}-${month}-${day}`;

      logger.debug('Signup attempt', { email: values.email });

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.fullName.trim(),
            username: values.username,
            birthday: birthdayISO,
          },
        },
      });

      // Erreur explicite Supabase (ex: "User already registered" si email confirmation OFF)
      if (error) {
        logger.warn('Signup failed', { message: error.message });
        setSignupError(mapAuthError(error.message));
        return;
      }

      const user = signUpData.user;

      // Détection email déjà utilisé quand email confirmation ON :
      // Supabase retourne le user existant sans erreur explicite.
      if (user) {
        const hasNoIdentities = !user.identities || user.identities.length === 0;

        let isStaleUser = false;
        if (user.created_at) {
          const createdMs = new Date(user.created_at).getTime();
          isStaleUser = Date.now() - createdMs > 10_000;
        }

        if (hasNoIdentities || isStaleUser) {
          logger.warn('Signup blocked — email already in use', {
            hasNoIdentities,
            isStaleUser,
          });
          setSignupError(mapAuthError('already registered'));
          return;
        }
      }

      logger.info('Signup successful — redirecting to feed');
      router.replace('/feed');
    } catch (err: unknown) {
      logger.error('Unexpected signup error', err);
      setSignupError(mapAuthError(null));
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = form.handleSubmit(performSignup);

  return {
    form,
    isLoading,
    signupError,
    onSubmit,
  };
}
