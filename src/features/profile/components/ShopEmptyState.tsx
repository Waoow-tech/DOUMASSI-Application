// Empty state de l'onglet Boutique — E3-VENDOR + E7-15 (#246).
// Partagé entre Mon profil et Profil d'un autre utilisateur.
//
// E7-15 : si on est sur Mon profil, on injecte un CTA "Publier ta première
// annonce" qui ouvre l'écran de création (E7-14 — /shop/create). Sur le
// profil d'un autre user, on garde le message neutre.

import { Plus, Store } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

export interface ShopEmptyStateProps {
  /** Si défini, affiche un CTA "Publier ta première annonce" qui appelle cette fonction. */
  onCreatePress?: () => void;
}

export function ShopEmptyState({ onCreatePress }: ShopEmptyStateProps = {}) {
  const isMine = typeof onCreatePress === 'function';
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
        {isMine ? 'Aucune annonce pour l’instant' : 'Aucun produit en vente'}
      </Text>
      {isMine ? (
        <Pressable
          onPress={onCreatePress}
          accessibilityRole="button"
          accessibilityLabel="Publier ta première annonce"
          style={styles.cta}
        >
          <XStack alignItems="center" gap={6}>
            <View>
              <Plus size={16} color="#000000" strokeWidth={2.6} />
            </View>
            <Text fontSize={14} fontWeight="800" color="#000000">
              Publier ta première annonce
            </Text>
          </XStack>
        </Pressable>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  cta: {
    backgroundColor: '#10D970',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
  },
});
