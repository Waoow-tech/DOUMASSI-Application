// Hook custom pour la logique d'inscription multi-étapes.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { signupSchema, STEP_1_FIELDS, type SignupFormValues } from '../schemas/signupSchema';

export function useSignup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      birthday: '',
      password: '',
      bio: '',
      isProfessional: false,
    },
    mode: 'onTouched',
  });

  const goToStep2 = async () => {
    const isValid = await form.trigger(STEP_1_FIELDS);
    if (isValid) {
      setStep(2);
      setSignupError(null);
    }
  };

  const goToStep1 = () => {
    setStep(1);
    setSignupError(null);
  };

  // ─── PICK AVATAR ────────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn("Permission galerie refusée par l'utilisateur");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setAvatarUri(asset.uri);
      logger.debug('[AVATAR] URI mis à jour:', asset.uri);
    } catch (err) {
      logger.error('[AVATAR] Erreur launchImageLibraryAsync:', err);
    }
  };

  // ─── UPLOAD AVATAR ───────────────────────────────────────────────────────────

  const uploadAvatar = async (userId: string): Promise<string | undefined> => {
    if (!avatarUri) return undefined;

    try {
      const fileInfo = await FileSystem.getInfoAsync(avatarUri);
      if (!fileInfo.exists) {
        logger.warn("[UPLOAD] Fichier introuvable à l'URI:", avatarUri);
        return undefined;
      }

      const ext = avatarUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const contentType = validExt === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${userId}/avatar.${validExt}`;

      // Fix for image_0cde45.png: using string literal for encoding
      const base64 = await FileSystem.readAsStringAsync(avatarUri, {
        encoding: 'base64',
      });

      if (!base64) return undefined;

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        logger.error('[UPLOAD] Erreur upload:', uploadError.message);
        return undefined;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err) {
      logger.error('[UPLOAD] Erreur inattendue uploadAvatar:', err);
      return undefined;
    }
  };

  // ─── SUBMIT ──────────────────────────────────────────────────────────────────

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setSignupError(null);

    try {
      const [day, month, year] = values.birthday.split('/');
      const birthdayISO = `${year}-${month}-${day}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.fullName.trim(),
            username: values.username,
            birthday: birthdayISO,
            bio: values.bio ?? '',
            is_professional: values.isProfessional,
          },
        },
      });

      if (signUpError) {
        setSignupError(signUpError.message);
        return;
      }

      const userId = signUpData.user?.id;

      if (userId && avatarUri) {
        const avatarUrl = await uploadAvatar(userId);

        if (avatarUrl) {
          await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
        }
      }

      router.push('/(auth)/verify');
    } catch (err) {
      logger.error('[SIGNUP] Erreur inattendue onSubmit:', err);
      setSignupError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setIsLoading(false);
    }
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
    onSubmit: form.handleSubmit(onSubmit),
  };
}
