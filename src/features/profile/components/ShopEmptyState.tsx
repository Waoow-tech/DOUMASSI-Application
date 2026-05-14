// Empty state de l'onglet Boutique — E3-VENDOR.
// Partagé entre Mon profil et Profil d'un autre utilisateur.

import { Store } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';

export function ShopEmptyState() {
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
        <Store size={32} color="#A0A0A0" />
      </YStack>
      <Text fontSize={15} color="$textSecondary" textAlign="center" fontWeight="500">
        Aucun produit en vente
      </Text>
    </YStack>
  );
}
