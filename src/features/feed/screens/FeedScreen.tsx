import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, Spinner, Text, YStack } from 'tamagui';

import { supabase } from '@/lib/supabase';

export function FeedScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack flex={1} padding="$5" gap="$4">
        <Text fontSize={28} fontWeight="700" color="$color">
          Feed
        </Text>

        <Text fontSize={15} color="$placeholderColor">
          Bienvenue sur DOUMASSI.
        </Text>

        <Button onPress={signOut} disabled={isSigningOut}>
          {isSigningOut ? <Spinner size="small" /> : 'Déconnexion'}
        </Button>
      </YStack>
    </ScrollView>
  );
}
