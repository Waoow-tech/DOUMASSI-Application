// Carte produit pour l'onglet Boutique — E3-VENDOR.
// Affiche l'image en ratio 1:1 avec deux overlays :
//   - Prix en bas à droite (fond sombre semi-transparent)
//   - Bouton "Voir le produit" en bas à gauche (fond blanc, texte noir)

import { Image } from 'expo-image';
import { Store } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, YStack } from 'tamagui';

import type { ProductItem } from '@/features/profile/hooks/useProducts';

interface ProductCardProps {
  product: ProductItem;
  size: number;
  gap: number;
  isLastColumn: boolean;
}

export function ProductCard({ product, size, gap, isLastColumn }: ProductCardProps) {
  const handleViewProduct = () => {
    // Placeholder — sera remplacé par une navigation vers la fiche produit.
    console.warn('Voir produit', product.id);
  };

  const formattedPrice = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(product.price);

  return (
    <YStack
      width={size}
      height={size}
      marginRight={isLastColumn ? 0 : gap}
      marginBottom={gap}
      position="relative"
    >
      {/* Image 1:1 */}
      {product.image_url ? (
        <Image
          source={{ uri: product.image_url }}
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
