// Écran de connexion — fidèle à la maquette DOUMASSI.
// Fond sombre, logo "D" centré en haut, container arrondi avec formulaire.
// Ticket E2-01 — Sprint 1 Auth & Onboarding.
// Pas de StyleSheet.create — tout passe par les props Tamagui.

import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { t } from '@/i18n';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

/**
 * Logo DOUMASSI — affiché via expo-image.
 * Dimensions 80×80 pour rester cohérent avec la maquette.
 */
function DoumassLogo() {
  return (
    <YStack alignItems="center" justifyContent="center" marginBottom="$6">
      <Image
        source={logoSource}
        style={{ width: 80, height: 80 }}
        contentFit="contain"
        accessibilityLabel="Logo DOUMASSI"
      />
    </YStack>
  );
}

export default function LoginScreen() {
  const { form, isLoading, loginError, onSubmit } = useLogin();
  const {
    signIn: signInWithGoogle,
    isLoading: isGoogleLoading,
    errorMessage: googleError,
  } = useGoogleAuth();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap="$5"
        width="100%"
        maxWidth={400}
        alignSelf="center"
      >
        {/* Logo en haut */}
        <DoumassLogo />

        {/* Container du formulaire — bordure fine grise, coins arrondis */}
        <YStack
          width="100%"
          borderWidth={1}
          borderColor="black"
          borderRadius="$6"
          padding="$5"
          gap="$4"
        >
          {/* Titre "Log in" */}
          <Text
            fontSize={28}
            fontWeight="700"
            color="$color"
            textAlign="center"
            fontFamily="$heading"
          >
            Log in
          </Text>

          {/* Champ : identifiant (email ou téléphone) */}
          <YStack gap="$1.5">
            <Controller
              control={form.control}
              name="identifier"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  id="login-identifier-input"
                  placeholder="Email address or phone number"
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
            {form.formState.errors.identifier?.message ? (
              <Text fontSize={12} color="$danger" paddingLeft="$1">
                {form.formState.errors.identifier.message}
              </Text>
            ) : null}
          </YStack>

          {/* Champ : mot de passe */}
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
                    id="login-password-input"
                    placeholder="Password"
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    borderWidth={0}
                    backgroundColor="transparent"
                    color="$color"
                    fontSize={14}
                    flex={1}
                    height={48}
                    paddingHorizontal="$3"
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

          {/* Erreur globale de connexion (Supabase) */}
          {loginError ? (
            <Text fontSize={13} color="$danger" textAlign="center">
              {loginError}
            </Text>
          ) : null}

          {/* Bouton principal "Log in" */}
          <Button
            id="login-submit-button"
            onPress={onSubmit}
            disabled={isLoading}
            backgroundColor="$color"
            color="$background"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            pressStyle={{
              opacity: 0.85,
              scale: 0.98,
            }}
            marginTop="$2"
          >
            {isLoading ? <Spinner size="small" color="$background" /> : 'Log in'}
          </Button>

          {/* Lien "Forgot your password ?" */}
          <Link href="/forgot-password" asChild>
            <Text
              id="login-forgot-password-link"
              fontSize={14}
              color="white"
              textAlign="center"
              marginTop="$1"
              pressStyle={{ opacity: 0.7 }}
              cursor="pointer"
            >
              Forgot your password ?
            </Text>
          </Link>

          {/* Bouton "Create an account" */}
          <Button
            id="login-create-account-button"
            onPress={() => router.push('/(auth)/signup')}
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$borderColor"
            color="$color"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            pressStyle={{
              opacity: 0.85,
              scale: 0.98,
              borderColor: '$borderColorHover',
            }}
            marginTop="$1"
          >
            Create an account
          </Button>

          {/* Séparateur "or" */}
          <XStack alignItems="center" gap="$3" marginTop="$2">
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
            <Text fontSize={12} color="$placeholderColor" fontWeight="600">
              or
            </Text>
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
          </XStack>

          {/* Bouton "Continue with Google" */}
          <Button
            id="login-google-button"
            onPress={signInWithGoogle}
            disabled={isGoogleLoading}
            backgroundColor="white"
            color="black"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={15}
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
            icon={
              <Text fontSize={18} fontWeight="700" color="#4285F4">
                G
              </Text>
            }
          >
            {isGoogleLoading ? (
              <Spinner size="small" color="black" />
            ) : (
              t.auth.google.continueWithGoogle
            )}
          </Button>

          {/* Erreur OAuth Google */}
          {googleError ? (
            <Text fontSize={13} color="$danger" textAlign="center">
              {googleError}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </ScrollView>
  );
}
