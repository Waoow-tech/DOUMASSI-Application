// Écran d'accueil post-login — placeholder MVP.
// Sera enrichi avec le vrai feed (FlashList + posts) lors des Sprints 3-4.
// Le sign out a été déplacé dans /settings (E2-12).
// Ticket E2-03 — Sprint 1 Auth & Onboarding.

import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

export function FeedScreen() {
  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack flex={1} padding="$5" gap="$4">
        {/* Header avec titre + accès Settings */}
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={28} fontWeight="700" color="$color">
            Feed
          </Text>

          <YStack
            onPress={() => router.push('/settings')}
            pressStyle={{ opacity: 0.6 }}
            cursor="pointer"
            padding="$2"
          >
            <Settings size={22} color="#FFFFFF" />
          </YStack>
        </XStack>

        <Text fontSize={15} color="$placeholderColor">
          Welcome to DOUMASSI.
        </Text>
      </YStack>
    </ScrollView>
  );
}
