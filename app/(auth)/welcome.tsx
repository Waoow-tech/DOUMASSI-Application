// Écran Welcome — premier écran pour user non authentifié.
// Logo + tagline + 2 boutons : "Sign in" et "Create an account".
// Ticket E2-01 — Sprint 1 Auth & Onboarding (livré dans le scope E2-07).

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Button, ScrollView, Text, YStack } from 'tamagui';

import { t } from '@/i18n';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

export default function WelcomeScreen() {
  const copy = t.auth.welcome;

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 48,
      }}
    >
      {/* Logo + tagline centrés en haut */}
      <YStack alignItems="center" gap="$4" marginTop="$8">
        <Image
          source={logoSource}
          style={{ width: 120, height: 120 }}
          contentFit="contain"
          accessibilityLabel="Logo DOUMASSI"
        />

        <Text fontSize={40} fontWeight="700" color="$color" letterSpacing={2} fontFamily="$heading">
          {t.splash.tagline}
        </Text>

        <Text
          fontSize={15}
          color="$placeholderColor"
          textAlign="center"
          lineHeight={22}
          paddingHorizontal="$4"
        >
          {copy.tagline}
        </Text>
      </YStack>

      {/* Boutons en bas */}
      <YStack gap="$3" width="100%" maxWidth={400} alignSelf="center">
        <Button
          id="welcome-signin-button"
          onPress={() => router.push('/(auth)/login')}
          backgroundColor="$color"
          color="$background"
          borderRadius="$4"
          height={52}
          fontWeight="700"
          fontSize={16}
          pressStyle={{ opacity: 0.85, scale: 0.98 }}
        >
          {copy.signIn}
        </Button>

        <Button
          id="welcome-signup-button"
          onPress={() => router.push('/(auth)/signup')}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$borderColor"
          color="$color"
          borderRadius="$4"
          height={52}
          fontWeight="700"
          fontSize={16}
          pressStyle={{
            opacity: 0.85,
            scale: 0.98,
            borderColor: '$borderColorHover',
          }}
        >
          {copy.createAccount}
        </Button>
      </YStack>
    </ScrollView>
  );
}
