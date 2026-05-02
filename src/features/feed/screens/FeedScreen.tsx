// Écran d'accueil post-login — placeholder MVP.
// Sera enrichi avec le vrai feed (FlashList + posts) lors des Sprints 3-4.
// Ticket E2-03 — Sprint 1 Auth & Onboarding.

import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, Spinner, Text, YStack } from 'tamagui';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function FeedScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('Échec signOut', { message: error.message });
      }
      router.replace('/(auth)/welcome');
    } catch (err: unknown) {
      logger.error('Erreur inattendue lors du signOut', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack flex={1} padding="$5" gap="$4">
        <Text fontSize={28} fontWeight="700" color="$color">
          Feed
        </Text>

        <Text fontSize={15} color="$placeholderColor">
          Welcome to DOUMASSI.
        </Text>

        <Button onPress={signOut} disabled={isSigningOut}>
          {isSigningOut ? <Spinner size="small" /> : 'Sign out'}
        </Button>
      </YStack>
    </ScrollView>
  );
}
