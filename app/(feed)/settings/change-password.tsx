import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { mapAuthError } from '@/features/auth/lib/mapAuthError';
import { useCurrentProfile } from '@/features/profile/hooks/useProfile';
import { useTranslations } from '@/i18n';
import type { ProfileScreensTranslations } from '@/i18n/fr/profileScreens';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Fabrique le schéma avec des messages traduits injectés (i18n). On passe le
// sous-dictionnaire `changePassword` : la logique de validation reste identique,
// seuls les libellés d'erreur sont paramétrés.
function createChangePasswordSchema(cp: ProfileScreensTranslations['changePassword']) {
  return z
    .object({
      currentPassword: z.string().min(1, cp.currentPasswordRequired),
      newPassword: z
        .string()
        .min(8, cp.passwordMinLength)
        .regex(/[A-Z]/, cp.passwordUppercase)
        .regex(/[0-9]/, cp.passwordDigit),
      confirmPassword: z.string().min(1, cp.confirmationRequired),
    })
    .superRefine((values, ctx) => {
      if (values.newPassword === values.currentPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: cp.newPasswordDifferent,
          path: ['newPassword'],
        });
      }

      if (values.confirmPassword !== values.newPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: cp.passwordsDoNotMatch,
          path: ['confirmPassword'],
        });
      }
    });
}

type ChangePasswordValues = z.infer<ReturnType<typeof createChangePasswordSchema>>;

function PasswordField({
  label,
  value,
  onChangeText,
  onBlur,
  visible,
  onToggleVisible,
  error,
  autoComplete,
  textContentType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  visible: boolean;
  onToggleVisible: () => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  textContentType: 'password' | 'newPassword';
}) {
  return (
    <YStack gap="$1.5">
      <Text color="$textSecondary" fontSize={13} fontWeight="700">
        {label}
      </Text>
      <XStack
        borderWidth={1}
        borderColor={error ? '$danger' : '$borderColor'}
        borderRadius="$4"
        alignItems="center"
        height={48}
        backgroundColor="$surface"
      >
        <Input
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete={autoComplete}
          textContentType={textContentType}
          borderWidth={0}
          backgroundColor="transparent"
          color="$color"
          fontSize={15}
          flex={1}
          height={48}
          paddingHorizontal="$3"
        />
        <YStack
          paddingHorizontal="$3"
          height={48}
          justifyContent="center"
          onPress={onToggleVisible}
          cursor="pointer"
          pressStyle={{ opacity: 0.62 }}
        >
          {visible ? <EyeOff size={20} color="#A0A0A0" /> : <Eye size={20} color="#A0A0A0" />}
        </YStack>
      </XStack>
      {error ? (
        <Text color="$danger" fontSize={12} paddingLeft="$1">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}

export default function ChangePasswordScreen() {
  const t = useTranslations();
  const cp = t.profileScreens.changePassword;
  const profileQuery = useCurrentProfile();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const changePasswordSchema = useMemo(() => createChangePasswordSchema(cp), [cp]);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const currentPasswordValue = form.watch('currentPassword');
  const newPasswordValue = form.watch('newPassword');
  const samePasswordError =
    currentPasswordValue.length > 0 && newPasswordValue.length > 0
      ? currentPasswordValue === newPasswordValue
        ? cp.samePasswordError
        : undefined
      : undefined;

  const changePassword = useMutation({
    mutationFn: async (values: ChangePasswordValues) => {
      const email = profileQuery.data?.email;

      if (!email) {
        throw new Error(cp.emailUnavailable);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: values.currentPassword,
      });

      if (signInError) {
        form.setError('currentPassword', { message: cp.currentPasswordIncorrect });
        throw new Error(cp.currentPasswordIncorrect);
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (updateError) {
        throw new Error(mapAuthError(updateError.message));
      }
    },
    onSuccess: () => {
      logger.info('Password changed');
      setToastVisible(true);
      setTimeout(() => {
        router.back();
      }, 800);
    },
    onError: (err) => {
      setFormError((err as Error).message);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    changePassword.mutate(values);
  });

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, []);

  const submitDisabled =
    Boolean(samePasswordError) ||
    !form.formState.isValid ||
    changePassword.isPending ||
    profileQuery.isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} backgroundColor="$background">
        <XStack
          height={56}
          paddingHorizontal="$4"
          alignItems="center"
          marginTop={Platform.OS === 'ios' ? '$6' : '$4'}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            flex={1}
            marginLeft="$3"
            color="$color"
            fontSize={20}
            fontWeight="700"
            fontFamily="$heading"
          >
            {cp.title}
          </Text>
        </XStack>

        <ScrollView
          flex={1}
          backgroundColor="$background"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <YStack width="100%" maxWidth={430} alignSelf="center" gap="$4">
            <Controller
              control={form.control}
              name="currentPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordField
                  label={cp.currentPasswordLabel}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  visible={showCurrentPassword}
                  onToggleVisible={() => setShowCurrentPassword((prev) => !prev)}
                  error={form.formState.errors.currentPassword?.message}
                  autoComplete="current-password"
                  textContentType="password"
                />
              )}
            />

            <Controller
              control={form.control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordField
                  label={cp.newPasswordLabel}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  visible={showNewPassword}
                  onToggleVisible={() => setShowNewPassword((prev) => !prev)}
                  error={samePasswordError ?? form.formState.errors.newPassword?.message}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              )}
            />

            <Controller
              control={form.control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordField
                  label={cp.confirmPasswordLabel}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((prev) => !prev)}
                  error={form.formState.errors.confirmPassword?.message}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              )}
            />

            {formError ? (
              <Text color="$danger" fontSize={13} textAlign="center">
                {formError}
              </Text>
            ) : null}

            <Button
              onPress={onSubmit}
              disabled={submitDisabled}
              backgroundColor="$color"
              color="$background"
              borderRadius="$4"
              height={50}
              fontWeight="800"
              fontSize={16}
              opacity={submitDisabled ? 0.48 : 1}
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
              marginTop="$2"
            >
              {changePassword.isPending ? <Spinner color="$background" /> : cp.submit}
            </Button>
          </YStack>
        </ScrollView>

        {toastVisible ? (
          <YStack
            position="absolute"
            bottom={96}
            alignSelf="center"
            backgroundColor="$surfaceElevated"
            borderWidth={1}
            borderColor="$accentNeon"
            borderRadius="$4"
            paddingHorizontal="$4"
            paddingVertical="$2"
          >
            <Text color="$color" fontSize={13} fontWeight="700">
              {cp.toast}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
});
