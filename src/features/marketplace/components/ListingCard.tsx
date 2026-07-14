// ListingCard — E7-10 — Card produit dans la grille Marketplace
//
// Layout (cf maquette CEO + brief L0) :
//   - image plein cover (1ère du `images[]`)
//   - badge promo (offre_speciale rouge / nouveaute|recommandation vert) en haut
//     à gauche — UN SEUL badge affiché (priorité au badge serveur, pas dupliqué
//     avec discount_percent)
//   - icône bookmark top-right, zone tap min 44pt, état actif vert plein
//   - badge état produit en bas-gauche de l'image (libellé FR : Neuf / Très bon
//     état / Bon état / Occasion)
//   - titre 1 ligne tronquée
//   - prix actuel + prix barré si discount_percent renseigné (recalcul client)
//   - compteur de vues sous le prix
//   - bouton "Voir le produit" → onPress

import { Image } from 'expo-image';
import { Bookmark, Eye } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import type { ListingCard as ListingCardData } from '../hooks/useListings';

const HIT_SLOP = { top: 12, right: 12, bottom: 12, left: 12 };

const BADGE_COLORS: Record<NonNullable<ListingCardData['badge']>, { bg: string; text: string }> = {
  offre_speciale: { bg: '#E53935', text: '#FFFFFF' }, // rouge contrast ~5.6:1 sur blanc
  nouveaute: { bg: '#10D970', text: '#000000' }, // accent neon + texte noir
  recommandation: { bg: '#10D970', text: '#000000' },
};

function formatPriceFromCents(cents: number, currency: string): string {
  const value = cents / 100;
  // Intl.NumberFormat est dispo en JS RN par défaut depuis Hermes — formatage
  // fr-FR (1 234,56) + symbole monnaie.
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function computeOriginalPrice(currentCents: number, discountPercent: number): number {
  // discount_percent est censé être appliqué au prix d'origine pour donner le
  // prix actuel. On reconstruit donc le prix original :
  //   currentCents = original * (1 - discount/100)
  //   → original = currentCents / (1 - discount/100)
  if (discountPercent <= 0 || discountPercent >= 100) return currentCents;
  return Math.round(currentCents / (1 - discountPercent / 100));
}

export interface ListingCardProps {
  listing: ListingCardData;
  onPress: () => void;
  onToggleBookmark: () => void;
  /** Indique si la mutation bookmark est en cours (désactive le tap). */
  isBookmarkPending?: boolean;
}

function ListingCardComponent({
  listing,
  onPress,
  onToggleBookmark,
  isBookmarkPending = false,
}: ListingCardProps) {
  const t = useTranslations();
  const firstImage = listing.images[0] ?? null;
  const conditionLabel = listing.condition ? t.marketplace.condition[listing.condition] : null;
  const badgeData = listing.badge
    ? { label: t.marketplace.badge[listing.badge], colors: BADGE_COLORS[listing.badge] }
    : null;

  const hasDiscount =
    typeof listing.discount_percent === 'number' &&
    listing.discount_percent > 0 &&
    listing.price_cents != null;

  const priceCurrent =
    listing.price_cents != null
      ? formatPriceFromCents(listing.price_cents, listing.currency)
      : null;

  const priceOriginal =
    hasDiscount && listing.price_cents != null && listing.discount_percent != null
      ? formatPriceFromCents(
          computeOriginalPrice(listing.price_cents, listing.discount_percent),
          listing.currency
        )
      : null;

  // Label a11y composite groupé (cf brief : "Casque audio sans fil, 120 euros
  // 55, moins 50 pourcent, vendu par emmadupont"). On évite que VoiceOver
  // lise 4 morceaux séparés.
  const accessibilityLabel = useCallback(() => {
    const parts: string[] = [listing.title];
    if (priceCurrent) parts.push(priceCurrent);
    if (hasDiscount && listing.discount_percent) {
      parts.push(t.marketplace.card.discountA11y(listing.discount_percent));
    }
    if (conditionLabel) parts.push(conditionLabel);
    parts.push(t.marketplace.card.soldByA11y(listing.seller_username));
    return parts.join(', ');
  }, [
    t,
    listing.title,
    priceCurrent,
    hasDiscount,
    listing.discount_percent,
    conditionLabel,
    listing.seller_username,
  ]);

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel()}
    >
      {/* Image plein cover, ratio carré */}
      <View style={styles.imageWrapper} backgroundColor="$surface">
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={styles.imagePlaceholder} backgroundColor="$surfaceElevated" />
        )}

        {/* Badge promo overlay top-left */}
        {badgeData ? (
          <View
            position="absolute"
            top={8}
            left={8}
            backgroundColor={badgeData.colors.bg}
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={9999}
            pointerEvents="none"
          >
            <Text fontSize={11} fontWeight="700" color={badgeData.colors.text}>
              {badgeData.label}
            </Text>
          </View>
        ) : null}

        {/* Bookmark icon top-right (zone tap ≥44pt via hitSlop) */}
        <Pressable
          onPress={onToggleBookmark}
          disabled={isBookmarkPending}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            listing.bookmarked_by_me ? t.marketplace.bookmark.remove : t.marketplace.bookmark.add
          }
          accessibilityState={{ selected: listing.bookmarked_by_me }}
          style={styles.bookmarkButton}
        >
          <Bookmark
            size={20}
            color={listing.bookmarked_by_me ? '#10D970' : '#FFFFFF'}
            fill={listing.bookmarked_by_me ? '#10D970' : 'transparent'}
            strokeWidth={2.2}
          />
        </Pressable>

        {/* Badge état bas-gauche de l'image */}
        {conditionLabel ? (
          <View
            position="absolute"
            bottom={8}
            left={8}
            backgroundColor="rgba(0,0,0,0.6)"
            paddingHorizontal={8}
            paddingVertical={3}
            borderRadius={6}
            pointerEvents="none"
          >
            <Text fontSize={10} fontWeight="600" color="#FFFFFF">
              {conditionLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Titre + prix + vues + CTA */}
      <YStack paddingHorizontal={10} paddingVertical={8} gap={4}>
        <Text fontSize={14} fontWeight="600" color="$color" numberOfLines={1}>
          {listing.title}
        </Text>

        <XStack alignItems="baseline" gap={6} flexWrap="wrap">
          {priceCurrent ? (
            <Text fontSize={15} fontWeight="800" color="$accentNeon">
              {priceCurrent}
            </Text>
          ) : null}
          {priceOriginal ? (
            <Text fontSize={12} color="$textSecondary" textDecorationLine="line-through">
              {priceOriginal}
            </Text>
          ) : null}
        </XStack>

        <XStack alignItems="center" gap={4} marginTop={2}>
          <Eye size={11} color="#A0A0A0" />
          <Text fontSize={11} color="$textSecondary">
            {listing.view_count}
          </Text>
        </XStack>

        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t.marketplace.card.viewProductA11y(listing.title)}
          style={styles.cta}
        >
          <Text fontSize={12} fontWeight="700" color="#000000">
            {t.marketplace.card.viewProduct}
          </Text>
        </Pressable>
      </YStack>
    </Pressable>
  );
}

export const ListingCard = memo(ListingCardComponent);

const styles = StyleSheet.create({
  bookmarkButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  cta: {
    marginTop: 6,
    backgroundColor: '#10D970',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1A1A1A',
  },
});
