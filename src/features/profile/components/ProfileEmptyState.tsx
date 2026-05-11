// État vide quand un profil n'a pas (encore) de posts.
// Utilisé par Mon profil et Profil autre.

import { Camera } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';

import { t } from '@/i18n';

export function ProfileEmptyState() {
  const copy = t.profile;
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical={80} gap="$3">
      <YStack
        width={72}
        height={72}
        borderRadius={36}
        borderWidth={2}
        borderColor="$borderColorHover"
        alignItems="center"
        justifyContent="center"
      >
        <Camera size={32} color="#A0A0A0" />
      </YStack>
      <Text fontSize={15} color="$textSecondary" textAlign="center" fontWeight="500">
        {copy.emptyState.title}
      </Text>
    </YStack>
  );
}
