// Écran d'accueil post-login — placeholder MVP.
// Sera enrichi avec le vrai feed (FlashList + posts) lors des Sprints 3-4.
// Le sign out a été déplacé dans /settings (E2-12).
// Ticket E2-03 — Sprint 1 Auth & Onboarding.

import { router } from 'expo-router';
import { Settings, User } from 'lucide-react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

export function FeedScreen() {
  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack flex={1} padding="$5" gap="$4">
        {/* Header avec titre + accès Profile / Settings */}
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={28} fontWeight="700" color="$color">
            Feed
          </Text>

          <XStack gap="$3" alignItems="center">
            <YStack
              onPress={() => router.push('/profile')}
              pressStyle={{ opacity: 0.6 }}
              cursor="pointer"
              padding="$2"
            >
              <User size={22} color="#FFFFFF" />
            </YStack>

            <YStack
              onPress={() => router.push('/settings')}
              pressStyle={{ opacity: 0.6 }}
              cursor="pointer"
              padding="$2"
            >
              <Settings size={22} color="#FFFFFF" />
            </YStack>
          </XStack>
        </XStack>

        <Text fontSize={15} color="$placeholderColor">
          Welcome to DOUMASSI.
        </Text>

        {/* ╔══════════════════════════════════════════════════════════╗
            ║  🚨🚨🚨 DELETE BEFORE PR — TEST ONLY — E3-03 DEMO 🚨🚨🚨  ║
            ╚══════════════════════════════════════════════════════════╝ */}
        <YStack
          marginTop="$4"
          padding="$4"
          borderWidth={2}
          borderColor="#FF3B30"
          borderStyle="dashed"
          borderRadius="$lg"
          backgroundColor="rgba(255,59,48,0.08)"
          gap="$2"
        >
          <Text fontSize={11} color="#FF3B30" fontWeight="800" textAlign="center">
            ⚠️ DELETE BEFORE PR — TEST NAVIGATION ONLY 45-82 ⚠️
          </Text>
          <YStack
            backgroundColor="$accentNeon"
            padding="$3"
            borderRadius="$md"
            alignItems="center"
            onPress={() => router.push('/profile/afa799a9-72a3-4aff-ba48-de9a2dde3c74')}
            pressStyle={{ opacity: 0.7, scale: 0.97 }}
            cursor="pointer"
          >
            <Text fontSize={14} fontWeight="700" color="#000000">
              View Test Profile (E3-03)
            </Text>
            <Text fontSize={11} color="#000000" opacity={0.6}>
              UUID: afa799a9-72a3-4aff-ba48-de9a2dde3c74
            </Text>
          </YStack>
          <Text fontSize={10} color="#FF3B30" textAlign="center" fontWeight="600">
            🚨 src/features/feed/screens/FeedScreen.tsx — REMOVE THIS BLOCK 🚨
          </Text>
        </YStack>
        {/* 🚨🚨🚨 END DELETE BEFORE PR 🚨🚨🚨 */}
      </YStack>
    </ScrollView>
  );
}
