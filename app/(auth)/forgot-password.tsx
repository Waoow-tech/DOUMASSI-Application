// Écran "Mot de passe oublié" — fidèle à la maquette DOUMASSI.
// Même squelette visuel que login.tsx pour garder un flow auth cohérent.
// Ticket E2-04 — Sprint 1 Auth & Onboarding.

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Controller } from 'react-hook-form';
import { Button, Input, ScrollView, Spinner, Text, YStack } from 'tamagui';

import { useForgotPassword } from '@/features/auth/hooks/useForgotPassword';
import { t } from '@/i18n';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

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

export default function ForgotPasswordScreen() {
  const { form, isLoading, errorMessage, successMessage, onSubmit } = useForgotPassword();
  const copy = t.auth.forgotPassword;

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

          <YStack gap="$1.5">
            <Controller
              control={form.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  id="forgot-password-email-input"
                  placeholder={copy.emailPlaceholder}
                  placeholderTextColor="$placeholderColor"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$4"
                  backgroundColor="transparent"
                  color="$color"
                  fontSize={14}
                  height={48}
                  paddingHorizontal="$3"
                />
              )}
            />
            {form.formState.errors.email?.message ? (
              <Text fontSize={12} color="$danger" paddingLeft="$1">
                {form.formState.errors.email.message}
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
            id="forgot-password-submit-button"
            onPress={onSubmit}
            disabled={isLoading}
            backgroundColor="$color"
            color="$background"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
            marginTop="$2"
          >
            {isLoading ? <Spinner size="small" color="$background" /> : copy.submit}
          </Button>

          <Link href="/(auth)/login" asChild>
            <Text
              id="forgot-password-back-link"
              fontSize={14}
              color="$color"
              fontWeight="700"
              textAlign="center"
              marginTop="$1"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
            >
              {copy.backToLogin}
            </Text>
          </Link>
        </YStack>
      </YStack>
    </ScrollView>
  );
}
