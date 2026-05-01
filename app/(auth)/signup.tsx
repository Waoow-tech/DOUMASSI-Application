// Écran d'inscription multi-étapes — fidèle aux maquettes DOUMASSI.
// Étape 1 : infos de base (5 champs) + Google OAuth mock + lien login.
// Étape 2 : avatar mock + bio + toggle professionnel + soumission Supabase.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.
// Pas de StyleSheet.create — tout passe par les props Tamagui.

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Plus, User } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Controller } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Button,
  Input,
  ScrollView,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
} from 'tamagui';

import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { useSignup } from '@/features/auth/hooks/useSignup';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

// ---------------------------------------------------------------------------
// Composants internes (pas exportés — usage local uniquement)
// ---------------------------------------------------------------------------

/** Barre de progression visuelle 1/2 ou 2/2. */
function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <XStack width="100%" gap="$2">
      <YStack flex={1} height={3} borderRadius="$full" backgroundColor="$color" />
      <YStack
        flex={1}
        height={3}
        borderRadius="$full"
        backgroundColor={step >= 2 ? '$color' : '$borderColor'}
      />
    </XStack>
  );
}

/** Logo DOUMASSI centré — taille réduite pour le signup. */
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

/** Placeholder avatar avec icône utilisateur + bouton rouge "+". */
// APRÈS
function AvatarPlaceholder({ onPress, uri }: { onPress: () => void; uri: string | null }) {
  return (
    <YStack alignItems="center" gap="$2" marginVertical="$2">
      {/* Wrapper relatif — taille du cercle, gère le onPress global */}
      <YStack
        width={100}
        height={100}
        onPress={onPress}
        pressStyle={{ opacity: 0.8 }}
        cursor="pointer"
      >
        {/* Cercle avatar — overflow:hidden uniquement ici pour cropper l'image */}
        <YStack
          width={100}
          height={100}
          borderRadius={50}
          backgroundColor="$surface"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: 100, height: 100, borderRadius: 50 }}
              contentFit="cover"
              accessibilityLabel="Photo de profil sélectionnée"
            />
          ) : (
            <User size={48} color="#A0A0A0" />
          )}
        </YStack>

        {/* Badge "+" — sur le wrapper parent, PAS dans le cercle overflow:hidden */}
        <YStack
          position="absolute"
          bottom={0}
          right={0}
          width={28}
          height={28}
          borderRadius={14}
          backgroundColor="$danger"
          alignItems="center"
          justifyContent="center"
          borderWidth={2}
          borderColor="$background"
        >
          <Plus size={14} color="#FFFFFF" />
        </YStack>
      </YStack>

      <Text fontSize={14} color="$textSecondary">
        {uri ? 'Change profile picture' : 'Add a profile picture'}
      </Text>
    </YStack>
  );
}

/**
 * Séparateur visuel avec texte centré.
 * Exemple : ————— Or log in with —————
 */
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

/**
 * Logo Google coloré (4 couleurs officielles).
 * Utilise react-native-svg — déjà installé via lucide-react-native.
 */
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

/**
 * Auto-format birthday : insère les "/" automatiquement.
 * Exemple : 2301 → 23/01, 23012005 → 23/01/2005
 */
function formatBirthdayInput(raw: string): string {
  // Ne garder que les chiffres
  const digits = raw.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

export default function SignupScreen() {
  const {
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
  } = useSignup();
  const {
    signIn: signInWithGoogle,
    isLoading: isGoogleLoading,
    errorMessage: googleError,
  } = useGoogleAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Handler birthday avec auto-format.
   * On intercepte le onChangeText pour formater avant de passer à RHF.
   */
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
        scrollEnabled={step === 1}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: step === 1 ? 'center' : 'flex-start',
          paddingHorizontal: 24,
          paddingTop: step === 2 ? 32 : 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack alignItems="center" gap="$3" width="100%" maxWidth={400} alignSelf="center">
          {/* Barre de progression */}
          <ProgressBar step={step} />

          {/* ============================================================= */}
          {/* ÉTAPE 1 — Informations de base                                 */}
          {/* ============================================================= */}
          {step === 1 && (
            <>
              {/* Logo + titre */}
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

                {/* Champ : Full name */}
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

                {/* Champ : Username */}
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

                {/* Champ : Email */}
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

                {/* Champ : Birthday (format JJ/MM/AAAA avec auto-format) */}
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

                {/* Champ : Password (avec toggle visibilité) */}
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

                {/* Champ : Confirm Password */}
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

                {/* Bouton "Create an account" → passe à step 2 */}
                <Button
                  id="signup-step1-button"
                  onPress={goToStep2}
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$4"
                  height={44}
                  fontWeight="700"
                  fontSize={15}
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  marginTop="$1"
                >
                  Create an account
                </Button>

                {/* Séparateur Google */}
                <Separator text="Or log in with" />

                {/* Bouton Google — OAuth via useGoogleAuth (E2-05) */}
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
            </>
          )}

          {/* ============================================================= */}
          {/* ÉTAPE 2 — Profil (avatar, bio, professionnel)                   */}
          {/* ============================================================= */}
          {step === 2 && (
            <>
              {/* Header: back arrow (left) + Skip button (right) */}
              <XStack
                width="100%"
                alignItems="center"
                justifyContent="space-between"
                marginBottom="$2"
              >
                <YStack
                  onPress={goToStep1}
                  pressStyle={{ opacity: 0.6 }}
                  cursor="pointer"
                  padding="$2"
                >
                  <ArrowLeft size={24} color="#FFFFFF" />
                </YStack>

                <YStack
                  onPress={skipStep2}
                  pressStyle={{ opacity: 0.8, scale: 0.96 }}
                  cursor="pointer"
                  backgroundColor="$danger"
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius="$4"
                >
                  <Text fontSize={13} fontWeight="700" color="#FFFFFF">
                    Skip
                  </Text>
                </YStack>
              </XStack>

              <YStack
                width="100%"
                borderWidth={1}
                borderColor="black"
                borderRadius="$6"
                padding="$4"
                gap="$2.5"
                alignItems="center"
              >
                {/* Avatar placeholder avec bouton "+" */}
                <AvatarPlaceholder onPress={pickAvatar} uri={avatarUri} />

                {/* Champ : Bio (textarea multi-lignes) */}
                <YStack gap="$1.5" width="100%">
                  <Controller
                    control={form.control}
                    name="bio"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextArea
                        id="signup-bio-input"
                        placeholder="Tell us about yourself..."
                        placeholderTextColor="$placeholderColor"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        numberOfLines={4}
                        maxLength={250}
                        borderWidth={1}
                        borderColor="$borderColor"
                        borderRadius="$4"
                        backgroundColor="transparent"
                        color="$color"
                        fontSize={14}
                        paddingHorizontal="$3"
                        paddingVertical="$3"
                        minHeight={90}
                        textAlignVertical="top"
                      />
                    )}
                  />
                  {form.formState.errors.bio?.message ? (
                    <Text fontSize={12} color="$danger" paddingLeft="$1">
                      {form.formState.errors.bio.message}
                    </Text>
                  ) : null}
                </YStack>

                {/* Champ : Gender */}
                <YStack gap="$2" width="100%">
                  <Text fontSize={14} fontWeight="600" color="$color">
                    Gender
                  </Text>
                  <Controller
                    control={form.control}
                    name="gender"
                    render={({ field: { onChange, value } }) => (
                      <XStack gap="$4" flexWrap="wrap">
                        {['male', 'female', 'other'].map((g) => (
                          <XStack
                            key={g}
                            alignItems="center"
                            gap="$2"
                            onPress={() => onChange(g)}
                            cursor="pointer"
                          >
                            <YStack
                              width={20}
                              height={20}
                              borderRadius={10}
                              borderWidth={2}
                              borderColor={value === g ? '$color' : '$borderColor'}
                              alignItems="center"
                              justifyContent="center"
                            >
                              {value === g && (
                                <YStack
                                  width={10}
                                  height={10}
                                  borderRadius={5}
                                  backgroundColor="$color"
                                />
                              )}
                            </YStack>
                            <Text fontSize={14} color="$color" textTransform="capitalize">
                              {g}
                            </Text>
                          </XStack>
                        ))}
                      </XStack>
                    )}
                  />
                  {form.formState.errors.gender?.message ? (
                    <Text fontSize={12} color="$danger" paddingLeft="$1">
                      {form.formState.errors.gender.message}
                    </Text>
                  ) : null}
                </YStack>

                {/* Toggle : Professional account */}
                <YStack width="100%" gap="$2">
                  <Controller
                    control={form.control}
                    name="isProfessional"
                    render={({ field: { onChange, value } }) => (
                      <XStack width="100%" justifyContent="space-between" alignItems="center">
                        <Text fontSize={16} fontWeight="600" color="$color">
                          Professional account
                        </Text>
                        <Switch
                          id="signup-professional-switch"
                          size="$3"
                          checked={value}
                          onCheckedChange={onChange}
                          backgroundColor={value ? '$accentNeon' : '$surface'}
                        >
                          <Switch.Thumb animation="quick" backgroundColor="$color" />
                        </Switch>
                      </XStack>
                    )}
                  />
                  <Text fontSize={12} color="$textSecondary" lineHeight={18}>
                    Activate this option if you represent a business, a brand, or an organization.
                    This will give you access to professional features.
                  </Text>
                </YStack>

                {/* Erreur globale Supabase */}
                {signupError ? (
                  <Text fontSize={13} color="$danger" textAlign="center" width="100%">
                    {signupError}
                  </Text>
                ) : null}

                {/* Bouton "Continue" → soumission finale Supabase */}
                <Button
                  id="signup-submit-button"
                  onPress={onSubmit}
                  disabled={isLoading}
                  backgroundColor="$color"
                  color="$background"
                  borderRadius="$4"
                  height={48}
                  fontWeight="700"
                  fontSize={16}
                  width="100%"
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  marginTop="$2"
                >
                  {isLoading ? <Spinner size="small" color="$background" /> : 'Continue'}
                </Button>
              </YStack>
            </>
          )}
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
