// SimilarListingsRow — E7-12
//
// Carousel horizontal des annonces similaires (même catégorie, triées par
// popularité côté DB via get_similar_listings).
//
// Mini-cards plus compactes que ListingCard : image + titre + prix. Tap →
// fiche produit de l'annonce similaire (router.push remplace l'écran courant
// pour éviter l'empilement infini quand on navigue d'annonce en annonce —
// d'où router.replace plutôt que router.push).

import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import type { SimilarListing } from '../hooks/useListingDetail';

const CARD_WIDTH = 140;

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export interface SimilarListingsRowProps {
  listings: SimilarListing[];
  onPressItem: (listingId: string) => void;
}

export function SimilarListingsRow({ listings, onPressItem }: SimilarListingsRowProps) {
  if (listings.length === 0) return null;

  return (
    <YStack gap={10} paddingHorizontal={16}>
      <Text fontSize={16} fontWeight="700" color="$color">
        Annonces similaires
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {listings.map((listing) => {
          const firstImage = listing.images[0];
          const priceLabel =
            listing.price_cents != null ? formatPrice(listing.price_cents, listing.currency) : null;
          return (
            <Pressable
              key={listing.id}
              onPress={() => onPressItem(listing.id)}
              accessibilityRole="button"
              accessibilityLabel={`${listing.title}${priceLabel ? `, ${priceLabel}` : ''}`}
              style={styles.card}
            >
              <View
                width={CARD_WIDTH}
                height={CARD_WIDTH}
                borderRadius={12}
                overflow="hidden"
                backgroundColor="$surface"
              >
                {firstImage ? (
                  <Image
                    source={{ uri: firstImage }}
                    style={styles.image}
                    contentFit="cover"
                    transition={150}
                  />
                ) : null}
              </View>
              <YStack marginTop={6} gap={2}>
                <Text fontSize={12} fontWeight="600" color="$color" numberOfLines={1}>
                  {listing.title}
                </Text>
                {priceLabel ? (
                  <XStack alignItems="center" gap={4}>
                    <Text fontSize={13} fontWeight="800" color="$accentNeon">
                      {priceLabel}
                    </Text>
                  </XStack>
                ) : null}
              </YStack>
            </Pressable>
          );
        })}
      </ScrollView>
    </YStack>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingRight: 16,
  },
});
