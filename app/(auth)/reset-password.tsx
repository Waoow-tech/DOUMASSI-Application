// Écran "Nouveau mot de passe" — finalise le flow forgot password.
// Reçoit la session via deep link (cf. useResetPassword).
// Design aligné sur login.tsx et forgot-password.tsx pour homogénéité.
// Ticket E2-04 — Sprint 1 Auth & Onboarding.

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { useResetPassword } from '@/features/auth/hooks/useResetPassword';
import { t } from '@/i18n';

const logoSource = require('../../assets/Logo-Doumassi.webp') as number;

function DoumassLogo() {
  return (
    <YStack alignItems="center" justifyContent="center" marginBottom="$6">
      <Image
        source={logoSource}
        style={{ width: 96, height: 96 }}
        contentFit="contain"
        accessibilityLabel="Logo DOUMASSI"
      />
    </YStack>
  );
}

export default function ResetPasswordScreen() {
  const { form, isLoading, errorMessage, successMessage, hasValidSession, onSubmit } =
    useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const copy = t.auth.resetPassword;

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 64,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <YStack alignItems="center" gap="$5" width="100%" maxWidth={400} alignSelf="center">
        <DoumassLogo />

        <YStack
          width="100%"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$6"
          padding="$5"
          gap="$4"
        >
          <Text
            fontSize={26}
            fontWeight="700"
            color="$color"
            textAlign="center"
            fontFamily="$heading"
            lineHeight={32}
          >
            {copy.title}
          </Text>

          <Text
            fontSize={14}
            color="$placeholderColor"
            textAlign="center"
            lineHeight={20}
            paddingHorizontal="$2"
          >
            {copy.subtitle}
          </Text>

          {/* Si pas de session valide (deep link absent ou expiré), on bloque le formulaire */}
          {!hasValidSession ? (
            <Text fontSize={13} color="$danger" textAlign="center" lineHeight={18}>
              {t.auth.resetPassword.invalidLink}
            </Text>
          ) : null}

          <YStack gap="$1.5">
            <Controller
              control={form.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <XStack
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$4"
                  alignItems="center"
                  height={48}
                  backgroundColor="transparent"
                >
                  <Input
                    id="reset-password-input"
                    placeholder={copy.passwordPlaceholder}
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    borderWidth={0}
                    backgroundColor="transparent"
                    color="$color"
                    fontSize={14}
                    flex={1}
                    height={48}
                    paddingHorizontal="$3"
                    editable={hasValidSession}
                  />
                  <YStack
                    paddingRight="$3"
                    onPress={() => setShowPassword((prev) => !prev)}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.6 }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#A0A0A0" />
                    ) : (
                      <Eye size={20} color="#A0A0A0" />
                    )}
                  </YStack>
                </XStack>
              )}
            />
            {form.formState.errors.password?.message ? (
              <Text fontSize={12} color="$danger" paddingLeft="$1">
                {form.formState.errors.password.message}
              </Text>
            ) : null}
          </YStack>

          <YStack gap="$1.5">
            <Controller
              control={form.control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  id="reset-password-confirm-input"
                  placeholder={copy.confirmPlaceholder}
                  placeholderTextColor="$placeholderColor"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$4"
                  backgroundColor="transparent"
                  color="$color"
                  fontSize={14}
                  height={48}
                  paddingHorizontal="$3"
                  editable={hasValidSession}
                />
              )}
            />
            {form.formState.errors.confirmPassword?.message ? (
              <Text fontSize={12} color="$danger" paddingLeft="$1">
                {form.formState.errors.confirmPassword.message}
              </Text>
            ) : null}
          </YStack>

          {errorMessage ? (
            <Text fontSize={13} color="$danger" textAlign="center">
              {errorMessage}
            </Text>
          ) : null}

          {successMessage ? (
            <Text fontSize={13} color="$accentNeon" textAlign="center" lineHeight={18}>
              {successMessage}
            </Text>
          ) : null}

          <Button
            id="reset-password-submit-button"
            onPress={onSubmit}
            disabled={isLoading || !hasValidSession}
            backgroundColor="$color"
            color="$background"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
            marginTop="$2"
            opacity={hasValidSession ? 1 : 0.5}
          >
            {isLoading ? <Spinner size="small" color="$background" /> : copy.submit}
          </Button>

          <Link href="/(auth)/login" asChild>
            <Text
              id="reset-password-back-link"
              fontSize={14}
              color="$color"
              fontWeight="700"
              textAlign="center"
              marginTop="$1"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
            >
              {t.auth.forgotPassword.backToLogin}
            </Text>
          </Link>
        </YStack>
      </YStack>
    </ScrollView>
  );
}
