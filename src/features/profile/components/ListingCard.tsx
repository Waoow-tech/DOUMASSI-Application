// Carte produit (Listing) pour l'onglet Boutique — E3-VENDOR + E7-15 (#246).
//
// Tile carré 1:1 sur la grille 3 colonnes de l'onglet boutique du profil.
// Diffère du ListingCard de la grille marketplace (qui est rectangulaire
// avec un footer textuel) — ici on reste sur le format vitrine vendeur,
// fidèle à la maquette Canva.
//
// E7-15 (#246) : le bouton "Voir le produit" navigue vers la fiche
// produit (E7-12 — /shop/[id]) au lieu de l'Alert placeholder.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Store } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, View, YStack } from 'tamagui';

import type { ListingItem } from '@/features/profile/hooks/useListings';

interface ListingCardProps {
  item: ListingItem;
  size: number;
  gap: number;
  isLastColumn: boolean;
}

const BADGE_LABEL: Record<string, string> = {
  offre_speciale: 'Promo',
  nouveaute: 'Nouveau',
  recommandation: 'Reco',
};

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  offre_speciale: { bg: '#E53935', text: '#FFFFFF' },
  nouveaute: { bg: '#10D970', text: '#000000' },
  recommandation: { bg: '#10D970', text: '#000000' },
};

export function ListingCard({ item, size, gap, isLastColumn }: ListingCardProps) {
  const handleViewProduct = useCallback(() => {
    router.push(`/shop/${item.id}`);
  }, [item.id]);

  const price = item.price_cents / 100;
  const formattedPrice = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: item.currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);

  const mainImage = item.images && item.images.length > 0 ? item.images[0] : null;
  const badgeData = item.badge ? BADGE_COLORS[item.badge] : null;
  const badgeText = item.badge ? BADGE_LABEL[item.badge] : null;

  return (
    <TouchableOpacity onPress={handleViewProduct} activeOpacity={0.85} style={{ borderRadius: 8 }}>
      <YStack
        width={size}
        height={size}
        marginRight={isLastColumn ? 0 : gap}
        marginBottom={gap}
        position="relative"
        accessibilityRole="button"
        accessibilityLabel={`Voir le produit ${item.title}, ${formattedPrice}`}
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

        {/* Badge promo overlay top-left */}
        {badgeData && badgeText ? (
          <View
            position="absolute"
            top={6}
            left={6}
            backgroundColor={badgeData.bg}
            paddingHorizontal={6}
            paddingVertical={2}
            borderRadius={9999}
            pointerEvents="none"
          >
            <Text fontSize={9} fontWeight="700" color={badgeData.text}>
              {badgeText}
            </Text>
          </View>
        ) : null}

        {/* Badge discount overlay top-right si pas de badge */}
        {!badgeData && item.discount_percent && item.discount_percent > 0 ? (
          <View
            position="absolute"
            top={6}
            right={6}
            backgroundColor="#E53935"
            paddingHorizontal={6}
            paddingVertical={2}
            borderRadius={6}
            pointerEvents="none"
          >
            <Text fontSize={9} fontWeight="700" color="#FFFFFF">
              -{item.discount_percent}%
            </Text>
          </View>
        ) : null}

        {/* Overlay Prix — bas à droite */}
        <YStack
          position="absolute"
          bottom={8}
          right={8}
          backgroundColor="rgba(0, 0, 0, 0.7)"
          paddingHorizontal={8}
          paddingVertical={4}
          borderRadius={6}
          pointerEvents="none"
        >
          <Text fontSize={13} fontWeight="700" color="#FFFFFF">
            {formattedPrice}
          </Text>
        </YStack>

        {/* Overlay Bouton — bas à gauche */}
        <View
          position="absolute"
          bottom={8}
          left={8}
          backgroundColor="#FFFFFF"
          paddingHorizontal={10}
          paddingVertical={5}
          borderRadius={6}
          pointerEvents="none"
        >
          <Text fontSize={11} fontWeight="600" color="#000000">
            Voir le produit
          </Text>
        </View>
      </YStack>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
});
