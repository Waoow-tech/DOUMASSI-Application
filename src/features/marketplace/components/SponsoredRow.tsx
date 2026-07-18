// SponsoredRow — E12-09
//
// Vitrine « Sponsorisé » en tête du marketplace : carrousel horizontal des
// annonces à mise en avant active (get_boosted_listings). Découplé de la grille
// principale et de sa pagination keyset (cf. ADR-005 / migration listing_boost).
//
// Rendu NUL s'il n'y a aucune annonce boostée → n'occupe pas d'espace inutile
// en haut de la liste.

import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import { useBoostedListings, useToggleListingBookmark } from '../hooks/useListings';

import { ListingCard } from './ListingCard';

const CARD_WIDTH = 150;

export function SponsoredRow() {
  const t = useTranslations();
  const boostedQuery = useBoostedListings();
  const toggleBookmark = useToggleListingBookmark();

  const listings = boostedQuery.data ?? [];
  if (listings.length === 0) return null; // rien à mettre en avant

  return (
    <YStack paddingTop={8} paddingBottom={4} gap={8}>
      <XStack alignItems="center" gap={6} paddingHorizontal={16}>
        <Sparkles size={16} color="#10D970" />
        <Text fontSize={14} fontWeight="800" color="$color">
          {t.marketplace.boost.sponsoredTitle}
        </Text>
      </XStack>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {listings.map((item) => (
          <View key={item.id} width={CARD_WIDTH}>
            <ListingCard
              listing={item}
              onPress={() => router.push(`/shop/${item.id}`)}
              onToggleBookmark={() => toggleBookmark.mutate({ listingId: item.id })}
              isBookmarkPending={toggleBookmark.isPending}
            />
          </View>
        ))}
      </ScrollView>
    </YStack>
  );
}
