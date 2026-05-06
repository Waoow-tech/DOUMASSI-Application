// Écran "Complete your account" — étape 0 pour les utilisateurs Google.
// Permet de choisir un vrai username et de confirmer sa date de naissance
// avant de passer à l'onboarding profil (avatar, bio, etc.).
//
// Design inspiré de signup.tsx mais allégé (2 champs seulement).
//
// Ticket E2-14 — Sprint 1 Auth & Onboarding.

import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input, ScrollView, Spinner, Text, YStack } from 'tamagui';

import { useUsernameAvailability } from '@/features/auth/hooks/useUsernameAvailability';
import { formatBirthdayInput } from '@/features/auth/lib/formatBirthday';
import {
  completeAccountSchema,
  type CompleteAccountFormValues,
} from '@/features/auth/schemas/completeAccountSchema';
import { t } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

export default function CompleteAccountScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CompleteAccountFormValues>({
    resolver: zodResolver(completeAccountSchema),
    defaultValues: {
      username: '',
      birthday: '',
    },
  });

  // Live unicity check sur le username (debounce 500ms côté hook)
  const usernameValue = form.watch('username');
  const usernameStatus = useUsernameAvailability(usernameValue);
  const usernameTaken = usernameStatus === 'taken';

  const submitDisabled =
    isLoading || usernameStatus === 'checking' || usernameTaken || !form.formState.isValid;

  const handleBirthdayChange = useCallback((text: string, rhfOnChange: (value: string) => void) => {
    rhfOnChange(formatBirthdayInput(text));
  }, []);

  const onSubmit = form.handleSubmit(async (values: CompleteAccountFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Session expired. Please sign in again.');
        return;
      }

      // Convert DD/MM/YYYY → YYYY-MM-DD for PostgreSQL date column
      const [dd, mm, yyyy] = values.birthday.split('/');
      const birthdayISO = `${yyyy}-${mm}-${dd}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: values.username.trim().toLowerCase(),
          birthday: birthdayISO,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      logger.info('Google account completed', { username: values.username });
      router.push('/(onboarding)/complete-profile');
    } catch (err: any) {
      logger.error('Complete account failed', err);
      setError(err.message ?? 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  });

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/welcome');
    } catch (err) {
      logger.error('Sign out failed', err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        flex={1}
        backgroundColor="$background"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack alignItems="center" gap="$3" width="100%" maxWidth={400} alignSelf="center">
          {/* ── Logo ── */}
          <YStack alignItems="center" justifyContent="center" marginBottom="$2">
            <Image
              source={logoSource}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
              accessibilityLabel="Logo DOUMASSI"
            />
          </YStack>

          <YStack
            width="100%"
            borderWidth={1}
            borderColor="black"
            borderRadius="$6"
            padding="$4"
            gap="$2.5"
          >
            <Text
              fontSize={24}
              fontWeight="700"
              color="$color"
              textAlign="center"
              fontFamily="$heading"
              marginBottom="$1"
            >
              Complete your account
            </Text>

            <Text
              fontSize={14}
              color="$placeholderColor"
              textAlign="center"
              lineHeight={20}
              marginBottom="$2"
            >
              Choose a username and confirm your birthday.
            </Text>

            {/* ── Username ── */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="complete-account-username-input"
                    placeholder="Username"
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    borderWidth={1}
                    borderColor={usernameTaken ? '$danger' : '$borderColor'}
                    borderRadius="$4"
                    backgroundColor="transparent"
                    color="$color"
                    fontSize={14}
                    height={44}
                    paddingHorizontal="$3"
                  />
                )}
              />
              {form.formState.errors.username?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.username.message}
                </Text>
              ) : usernameStatus === 'checking' ? (
                <Text fontSize={11} color="$placeholderColor" paddingLeft="$1">
                  {t.auth.signup.usernameChecking}
                </Text>
              ) : usernameStatus === 'available' ? (
                <Text fontSize={11} color="$accentNeon" paddingLeft="$1">
                  ✓ {t.auth.signup.usernameAvailable}
                </Text>
              ) : usernameStatus === 'taken' ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  ✗ {t.auth.signup.usernameTaken}
                </Text>
              ) : usernameStatus === 'error' ? (
                <Text fontSize={11} color="$placeholderColor" paddingLeft="$1">
                  {t.auth.signup.usernameCheckError}
                </Text>
              ) : null}
            </YStack>

            {/* ── Birthday ── */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="birthday"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="complete-account-birthday-input"
                    placeholder="Birthday (DD/MM/YYYY)"
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={(text) => handleBirthdayChange(text, onChange)}
                    onBlur={onBlur}
                    keyboardType="numeric"
                    maxLength={10}
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$4"
                    backgroundColor="transparent"
                    color="$color"
                    fontSize={14}
                    height={44}
                    paddingHorizontal="$3"
                  />
                )}
              />
              {form.formState.errors.birthday?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.birthday.message}
                </Text>
              ) : null}
            </YStack>

            {/* ── Error ── */}
            {error ? (
              <Text fontSize={12} color="$danger" textAlign="center">
                {error}
              </Text>
            ) : null}

            {/* ── Continue ── */}
            <Button
              id="complete-account-submit-button"
              onPress={onSubmit}
              disabled={submitDisabled}
              backgroundColor="$color"
              color="$background"
              borderRadius="$4"
              height={44}
              fontWeight="700"
              fontSize={15}
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
              marginTop="$1"
              opacity={submitDisabled ? 0.5 : 1}
            >
              {isLoading ? <Spinner size="small" color="$background" /> : 'Continue'}
            </Button>

            {/* ── Sign out ── */}
            <Button
              id="complete-account-signout-button"
              onPress={handleSignOut}
              backgroundColor="transparent"
              color="$placeholderColor"
              fontWeight="600"
              fontSize={14}
              marginTop="$2"
              pressStyle={{ opacity: 0.7 }}
            >
              Sign out
            </Button>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
