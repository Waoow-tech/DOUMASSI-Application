// Écran d'onboarding — placeholder.
// Ce squelette sera remplacé par les vrais steps (pseudo, avatar, cover, intérêts)
// dans les tickets E2-08 à E2-11.
// Ticket E2-07 — Sprint 1 Auth & Onboarding.

import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Spinner, Text, YStack } from 'tamagui';

import { t } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export default function OnboardingPlaceholder() {
  const copy = t.auth.onboarding;
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('Sign out failed', { message: error.message });
      }
      router.replace('/(auth)/welcome');
    } catch (err: unknown) {
      logger.error('Unexpected sign out error', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$5"
      gap="$5"
    >
      <Text fontSize={32} fontWeight="700" color="$color" textAlign="center" fontFamily="$heading">
        {copy.placeholderTitle}
      </Text>

      <Text fontSize={15} color="$placeholderColor" textAlign="center" lineHeight={22}>
        {copy.placeholderSubtitle}
      </Text>

      <Button
        onPress={() => router.replace('/feed')}
        backgroundColor="$color"
        color="$background"
        borderRadius="$4"
        height={48}
        fontWeight="700"
        fontSize={16}
        width="100%"
        maxWidth={320}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
      >
        {copy.continueToFeed}
      </Button>

      {/* Échappatoire pour sortir tant que les vrais steps onboarding n'existent pas */}
      <Button
        onPress={handleSignOut}
        disabled={isSigningOut}
        backgroundColor="transparent"
        color="$placeholderColor"
        fontWeight="600"
        fontSize={14}
        marginTop="$2"
        pressStyle={{ opacity: 0.7 }}
      >
        {isSigningOut ? <Spinner size="small" color="$placeholderColor" /> : 'Sign out'}
      </Button>
    </YStack>
  );
}
