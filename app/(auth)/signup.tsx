// Écran d'inscription — page unique.
// Champs : Full name, Username, Email/phone, Birthday, Password, Confirm password.
// Bouton Google OAuth + lien vers login.
//
// Refactor E2-02b : suppression de la step 2 (avatar/bio/professional/gender)
// — ces champs sont collectés dans l'onboarding (E2-09 + E2-10).
//
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { useSignup } from '@/features/auth/hooks/useSignup';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

// ---------------------------------------------------------------------------
// Composants internes
// ---------------------------------------------------------------------------

function DoumassLogo() {
  return (
    <YStack alignItems="center" justifyContent="center" marginBottom="$2">
      <Image
        source={logoSource}
        style={{ width: 48, height: 48 }}
        contentFit="contain"
        accessibilityLabel="Logo DOUMASSI"
      />
    </YStack>
  );
}

function Separator({ text }: { text: string }) {
  return (
    <XStack alignItems="center" gap="$3" width="100%" marginVertical="$1">
      <YStack flex={1} height={1} backgroundColor="$borderColor" />
      <Text fontSize={12} color="$textSecondary">
        {text}
      </Text>
      <YStack flex={1} height={1} backgroundColor="$borderColor" />
    </XStack>
  );
}

/** Logo Google coloré (4 couleurs officielles). */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/** Auto-format birthday : insère les "/" automatiquement. */
function formatBirthdayInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function SignupScreen() {
  const { form, isLoading, signupError, onSubmit } = useSignup();
  const {
    signIn: signInWithGoogle,
    isLoading: isGoogleLoading,
    errorMessage: googleError,
  } = useGoogleAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleBirthdayChange = useCallback((text: string, rhfOnChange: (value: string) => void) => {
    rhfOnChange(formatBirthdayInput(text));
  }, []);

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
          <DoumassLogo />

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
              Create an account
            </Text>

            {/* Full name */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="signup-fullname-input"
                    placeholder="Full name"
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoComplete="name"
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
              {form.formState.errors.fullName?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.fullName.message}
                </Text>
              ) : null}
            </YStack>

            {/* Username */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="signup-username-input"
                    placeholder="Username"
                    placeholderTextColor="$placeholderColor"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
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
              {form.formState.errors.username?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.username.message}
                </Text>
              ) : null}
            </YStack>

            {/* Email / phone */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="signup-email-input"
                    placeholder="Email or phone number"
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
                    height={44}
                    paddingHorizontal="$3"
                  />
                )}
              />
              {form.formState.errors.email?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.email.message}
                </Text>
              ) : null}
            </YStack>

            {/* Birthday */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="birthday"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="signup-birthday-input"
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

            {/* Password */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <XStack
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$4"
                    alignItems="center"
                    height={44}
                    backgroundColor="transparent"
                  >
                    <Input
                      id="signup-password-input"
                      placeholder="Password"
                      placeholderTextColor="$placeholderColor"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      borderWidth={0}
                      backgroundColor="transparent"
                      color="$color"
                      fontSize={14}
                      flex={1}
                      height={44}
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
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.password.message}
                </Text>
              ) : null}
            </YStack>

            {/* Confirm password */}
            <YStack gap="$1">
              <Controller
                control={form.control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <XStack
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$4"
                    alignItems="center"
                    height={44}
                    backgroundColor="transparent"
                  >
                    <Input
                      id="signup-confirm-password-input"
                      placeholder="Confirm password"
                      placeholderTextColor="$placeholderColor"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      borderWidth={0}
                      backgroundColor="transparent"
                      color="$color"
                      fontSize={14}
                      flex={1}
                      height={44}
                      paddingHorizontal="$3"
                    />
                    <YStack
                      paddingRight="$3"
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      cursor="pointer"
                      pressStyle={{ opacity: 0.6 }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} color="#A0A0A0" />
                      ) : (
                        <Eye size={20} color="#A0A0A0" />
                      )}
                    </YStack>
                  </XStack>
                )}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <Text fontSize={11} color="$danger" paddingLeft="$1">
                  {form.formState.errors.confirmPassword.message}
                </Text>
              ) : null}
            </YStack>

            {/* Erreur globale Supabase */}
            {signupError ? (
              <Text fontSize={12} color="$danger" textAlign="center">
                {signupError}
              </Text>
            ) : null}

            {/* Bouton "Create an account" — submit direct */}
            <Button
              id="signup-submit-button"
              onPress={onSubmit}
              disabled={isLoading}
              backgroundColor="$color"
              color="$background"
              borderRadius="$4"
              height={44}
              fontWeight="700"
              fontSize={15}
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
              marginTop="$1"
            >
              {isLoading ? <Spinner size="small" color="$background" /> : 'Create an account'}
            </Button>

            {/* Séparateur Google */}
            <Separator text="Or log in with" />

            {/* Bouton Google */}
            <Button
              id="signup-google-button"
              onPress={signInWithGoogle}
              disabled={isGoogleLoading}
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              height={44}
              pressStyle={{
                opacity: 0.85,
                scale: 0.98,
                borderColor: '$borderColorHover',
              }}
            >
              {isGoogleLoading ? (
                <Spinner size="small" color="$color" />
              ) : (
                <XStack alignItems="center" gap="$2.5">
                  <GoogleLogo size={20} />
                  <Text fontSize={14} fontWeight="600" color="$color">
                    Google
                  </Text>
                </XStack>
              )}
            </Button>

            {/* Erreur OAuth Google */}
            {googleError ? (
              <Text fontSize={12} color="$danger" textAlign="center" marginTop="$1">
                {googleError}
              </Text>
            ) : null}

            {/* Lien vers login */}
            <XStack justifyContent="center" gap="$1.5" marginTop="$1">
              <Text fontSize={13} color="$textSecondary">
                Already registered ?
              </Text>
              <Link href="/(auth)/login" asChild>
                <Text
                  id="signup-login-link"
                  fontSize={13}
                  color="$color"
                  fontWeight="600"
                  pressStyle={{ opacity: 0.7 }}
                  cursor="pointer"
                >
                  Log in
                </Text>
              </Link>
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
