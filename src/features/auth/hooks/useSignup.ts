// Hook for multi-step signup logic.
// Uses useAvatarPicker for avatar (separation of concerns).
// Uses mapAuthError for user-friendly error messages.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { signupSchema, STEP_1_FIELDS, type SignupFormValues } from '../schemas/signupSchema';

import { useAvatarPicker } from './useAvatarPicker';

export function useSignup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const { avatarUri, pickAvatar, uploadAvatar } = useAvatarPicker();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      birthday: '',
      password: '',
      confirmPassword: '',
      bio: '',
      gender: '',
      isProfessional: false,
    },
    mode: 'onTouched',
  });

  /** Validate step 1, then advance to step 2. */
  const goToStep2 = async () => {
    const isValid = await form.trigger(STEP_1_FIELDS);
    if (isValid) {
      setStep(2);
      setSignupError(null);
    }
  };

  /** Back to step 1 (step 2 data is preserved in the form). */
  const goToStep1 = () => {
    setStep(1);
    setSignupError(null);
  };

  /**
   * Core signup logic — shared between onSubmit and skipStep2.
   * Uploads avatar if present, then calls supabase.auth.signUp()
   * with all metadata in options.data (avoids RLS issues post-signup).
   */
  const performSignup = async (values: SignupFormValues) => {
    setIsLoading(true);
    setSignupError(null);

    try {
      // 1. Upload avatar before signUp to have the URL
      const tempId = `pending_${Date.now()}`;
      const avatarUrl = await uploadAvatar(tempId);

      // 2. Convert birthday DD/MM/YYYY → ISO YYYY-MM-DD
      const [day, month, year] = values.birthday.split('/');
      const birthdayISO = `${year}-${month}-${day}`;

      logger.debug('Signup attempt', { email: values.email });

      // 3. Supabase signUp — backend trigger populates profiles via raw_user_meta_data
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.fullName.trim(),
            username: values.username,
            birthday: birthdayISO,
            bio: values.bio || '',
            gender: values.gender || '',
            is_professional: values.isProfessional,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          },
        },
      });

      // Explicit error from Supabase (email confirmation OFF → "User already registered")
      if (error) {
        logger.warn('Signup failed', { message: error.message });
        setSignupError(mapAuthError(error.message));
        return;
      }

      const user = signUpData.user;

      // Log the response for debugging email duplicate detection
      logger.debug('Signup response', {
        hasUser: !!user,
        identitiesCount: user?.identities?.length ?? 'undefined',
        hasSession: !!signUpData.session,
        createdAt: user?.created_at,
      });

      if (user) {
        // Strategy 1: Empty identities (email confirmation ON, email already taken)
        const hasNoIdentities = !user.identities || user.identities.length === 0;

        // Strategy 2: User was created well before this request
        // Supabase returns the EXISTING user object without creating a new one
        let isStaleUser = false;
        if (user.created_at) {
          const createdMs = new Date(user.created_at).getTime();
          const nowMs = Date.now();
          isStaleUser = nowMs - createdMs > 10_000; // More than 10s ago = existing user
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

      logger.info('Signup successful — redirecting to home feed');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      logger.error('Unexpected signup error', err);
      setSignupError(mapAuthError(null));
    } finally {
      setIsLoading(false);
    }
  };

  /** Final submission via form.handleSubmit (validates all fields). */
  const onSubmit = form.handleSubmit(performSignup);

  /**
   * Skip step 2 — submit with only step 1 data (step 2 fields keep defaults).
   * Step 1 was already validated by goToStep2(), so we can submit directly.
   */
  const skipStep2 = () => {
    const values = form.getValues();
    void performSignup(values);
  };

  return {
    form,
    step,
    isLoading,
    signupError,
    avatarUri,
    goToStep1,
    goToStep2,
    pickAvatar,
    skipStep2,
    onSubmit,
  };
}
