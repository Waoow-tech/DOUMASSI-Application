// Écran Paramètres — accessible via /settings (groupe (feed) donc protégé par le guard).
// Contient pour l'instant uniquement le bouton "Se déconnecter" avec confirmation native.
// Sera enrichi (notifications, langue, compte, etc.) dans des sprints ultérieurs.
//
// Ticket E2-12 — Sprint 1 Auth & Onboarding.

import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Alert } from 'react-native';
import { Button, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { useLogout } from '@/features/auth/hooks/useLogout';
import { t } from '@/i18n';

export default function SettingsScreen() {
  const { logout, isLoading } = useLogout();
  const copy = t.auth.settings;

  const confirmLogout = () => {
    Alert.alert(copy.logoutConfirmTitle, copy.logoutConfirmMessage, [
      { text: copy.logoutConfirmCancel, style: 'cancel' },
      {
        text: copy.logoutConfirmAction,
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 64, paddingBottom: 48 }}
    >
      {/* Header avec back arrow + titre */}
      <XStack alignItems="center" gap="$3" paddingHorizontal="$5" marginBottom="$6" height={32}>
        <YStack
          onPress={() => router.back()}
          pressStyle={{ opacity: 0.6 }}
          cursor="pointer"
          padding="$1"
          marginLeft={-4}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </YStack>
        <Text fontSize={22} fontWeight="700" color="$color" fontFamily="$heading">
          {copy.title}
        </Text>
      </XStack>

      {/* Section Compte */}
      <YStack paddingHorizontal="$5" gap="$3">
        <Text
          fontSize={12}
          color="$placeholderColor"
          fontWeight="600"
          letterSpacing={0.5}
          marginBottom="$1"
        >
          {copy.logoutSection.toUpperCase()}
        </Text>

        <Button
          id="settings-logout-button"
          onPress={confirmLogout}
          disabled={isLoading}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$danger"
          color="$danger"
          borderRadius="$4"
          height={48}
          fontWeight="700"
          fontSize={15}
          pressStyle={{ opacity: 0.85, scale: 0.98 }}
        >
          {isLoading ? <Spinner size="small" color="$danger" /> : copy.logoutButton}
        </Button>
      </YStack>
    </ScrollView>
  );
}
