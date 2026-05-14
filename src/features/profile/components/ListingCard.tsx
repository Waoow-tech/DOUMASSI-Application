// Carte produit (Listing) pour l'onglet Boutique — E3-VENDOR.
// Affiche l'image principale en ratio 1:1 avec les overlays prix et action.

import { Image } from 'expo-image';
import { Store } from 'lucide-react-native';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, YStack } from 'tamagui';

import type { ListingItem } from '@/features/profile/hooks/useListings';

interface ListingCardProps {
  item: ListingItem;
  size: number;
  gap: number;
  isLastColumn: boolean;
}

export function ListingCard({ item, size, gap, isLastColumn }: ListingCardProps) {
  // Placeholder MVP : la page produit n'existe pas encore (vertical Marketplace
  // au Sprint 5). On affiche un message d'attente plutôt que de naviguer.
  const handleViewProduct = () => {
    Alert.alert('Bientôt disponible', 'La page produit arrive prochainement.');
  };

  // Conversion cents -> unité principale
  const price = item.price_cents / 100;
  const formattedPrice = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: item.currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);

  const mainImage = item.images && item.images.length > 0 ? item.images[0] : null;

  return (
    <YStack
      width={size}
      height={size}
      marginRight={isLastColumn ? 0 : gap}
      marginBottom={gap}
      position="relative"
    >
      {/* Image 1:1 */}
      {mainImage ? (
        <Image
          source={{ uri: mainImage }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <YStack
          flex={1}
          backgroundColor="$surface"
          alignItems="center"
          justifyContent="center"
          borderRadius={8}
        >
          <Store size={32} color="#A0A0A0" />
        </YStack>
      )}

      {/* Overlay Prix — bas à droite */}
      <YStack
        position="absolute"
        bottom={8}
        right={8}
        backgroundColor="rgba(0, 0, 0, 0.7)"
        paddingHorizontal={8}
        paddingVertical={4}
        borderRadius={6}
      >
        <Text fontSize={13} fontWeight="700" color="#FFFFFF">
          {formattedPrice}
        </Text>
      </YStack>

      {/* Overlay Bouton — bas à gauche */}
      <TouchableOpacity onPress={handleViewProduct} activeOpacity={0.8} style={styles.viewButton}>
        <Text fontSize={11} fontWeight="600" color="#000000">
          Voir le produit
        </Text>
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  viewButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
});
