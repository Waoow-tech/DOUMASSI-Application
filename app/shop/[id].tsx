// Écran Fiche produit — E7-12 + intégration CTA Contacter vendeur (E7-13)
//
// Layout (cf brief Marketplace L0 + maquette CEO) :
//   - Header retour + bookmark toggle (top-right)
//   - Carousel images (E7-12 — ListingImageCarousel)
//   - Badge promo conditionnel au-dessus du titre
//   - Titre + prix actuel + prix barré si discount + état + localisation +
//     date relative + compteur de vues
//   - Description complète
//   - Carte vendeur cliquable → /profile/[id]
//   - Section "Annonces similaires" (SimilarListingsRow)
//   - CTA sticky bottom plein largeur "Contacter le vendeur" → useGetOrCreateDm
//     puis router.push vers la conversation avec un message pré-rempli
//
// Garde-fou : si je suis le vendeur de l'annonce → on désactive le CTA et on
// affiche "C'est votre annonce" pour éviter la création d'un DM avec soi-même
// (que la RPC get_or_create_dm rejette de toute façon côté DB, mais autant
// éviter l'aller-retour).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bookmark, Eye, MapPin, Rocket } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, View, XStack, YStack } from 'tamagui';

import { ListingImageCarousel } from '@/features/marketplace/components/ListingImageCarousel';
import { SellerCard } from '@/features/marketplace/components/SellerCard';
import { SimilarListingsRow } from '@/features/marketplace/components/SimilarListingsRow';
import {
  useListingDetail,
  useSimilarListings,
} from '@/features/marketplace/hooks/useListingDetail';
import {
  LISTING_BOOST_COST,
  LISTING_BOOST_DAYS,
  useBoostListing,
  useToggleListingBookmark,
} from '@/features/marketplace/hooks/useListings';
import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { newIdempotencyKey, useWallet } from '@/features/wallet/hooks/useWallet';
import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  offre_speciale: { bg: '#E53935', text: '#FFFFFF' },
  nouveaute: { bg: '#10D970', text: '#000000' },
  recommandation: { bg: '#10D970', text: '#000000' },
};

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

function computeOriginalPrice(currentCents: number, discountPercent: number): number {
  if (discountPercent <= 0 || discountPercent >= 100) return currentCents;
  return Math.round(currentCents / (1 - discountPercent / 100));
}

// Hors composant : accès non-réactif via getT(). Le composant appelant se
// re-render au changement de langue (il consomme useTranslations), donc cette
// fonction sera rappelée avec la langue à jour.
function formatRelative(iso: string): string {
  const t = getT();
  const rt = t.marketplace.relativeTime;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const elapsedMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return rt.justNow;
  if (minutes < 60) return rt.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rt.hours(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return rt.days(days);
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return rt.weeks(weeks);
  const months = Math.floor(days / 30);
  if (months < 12) return rt.months(months);
  return rt.years(Math.floor(days / 365));
}

export default function ListingDetailScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const listingId = typeof params.id === 'string' ? params.id : null;

  const { data: listing, isLoading, isError } = useListingDetail(listingId);
  const { listings: similar } = useSimilarListings(listingId);
  const toggleBookmark = useToggleListingBookmark();
  const getOrCreateDm = useGetOrCreateDm();
  const walletQuery = useWallet();
  const boost = useBoostListing();
  // Clé d'idempotence du boost en cours : générée une fois, conservée en cas
  // d'échec (retry = même clé => pas de double débit), remise à zéro au succès.
  const boostKeyRef = useRef<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setMeId(data.session?.user.id ?? null);
    })();
  }, []);

  const isMyListing = meId !== null && listing != null && listing.seller_id === meId;

  // Recompute du prix original côté client (cohérent avec ListingCard)
  const priceCurrent = useMemo(
    () =>
      listing?.price_cents != null ? formatPrice(listing.price_cents, listing.currency) : null,
    [listing?.price_cents, listing?.currency]
  );

  const priceOriginal = useMemo(() => {
    if (
      !listing ||
      listing.price_cents == null ||
      !listing.discount_percent ||
      listing.discount_percent <= 0
    ) {
      return null;
    }
    return formatPrice(
      computeOriginalPrice(listing.price_cents, listing.discount_percent),
      listing.currency
    );
  }, [listing]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/shop');
  }, []);

  const handleToggleBookmark = useCallback(() => {
    if (!listingId) return;
    toggleBookmark.mutate({ listingId });
  }, [listingId, toggleBookmark]);

  const handleOpenSeller = useCallback(() => {
    if (!listing) return;
    router.push(`/profile/${listing.seller_id}`);
  }, [listing]);

  const handlePressSimilar = useCallback((otherId: string) => {
    // Replace plutôt que push pour éviter d'empiler des fiches produit en
    // boucle (sinon le back stack peut grossir indéfiniment quand on navigue
    // d'une annonce similaire à une autre).
    router.replace(`/shop/${otherId}`);
  }, []);

  // E12-09 — Booster mon annonce (dépense de Dcoins)
  const doBoost = useCallback(() => {
    if (!listing) return;
    if (!boostKeyRef.current) boostKeyRef.current = newIdempotencyKey();
    boost.mutate(
      { listingId: listing.id, idempotencyKey: boostKeyRef.current },
      {
        onSuccess: () => {
          boostKeyRef.current = null; // prochain boost = nouvelle dépense
          Alert.alert(
            t.marketplace.boost.successTitle,
            t.marketplace.boost.successMessage(LISTING_BOOST_DAYS)
          );
        },
        onError: (err) => {
          // On conserve la clé : un nouvel essai rejoue la même opération.
          const insufficient = err.message?.toLowerCase().includes('solde insuffisant');
          Alert.alert(
            t.marketplace.boost.errorTitle,
            insufficient ? t.marketplace.boost.insufficient : t.marketplace.boost.genericError
          );
        },
      }
    );
  }, [listing, boost, t]);

  const handleBoost = useCallback(() => {
    if (!listing) return;
    const balance = walletQuery.data ?? 0;
    Alert.alert(
      t.marketplace.boost.confirmTitle,
      t.marketplace.boost.confirmMessage(LISTING_BOOST_COST, LISTING_BOOST_DAYS, balance),
      [
        { text: t.marketplace.boost.cancel, style: 'cancel' },
        { text: t.marketplace.boost.confirmAction, onPress: doBoost },
      ]
    );
  }, [listing, walletQuery.data, t, doBoost]);

  // E7-13 — CTA Contacter vendeur
  const handleContactSeller = useCallback(() => {
    if (!listing) return;
    if (isMyListing) return; // garde-fou
    const prefill = t.marketplace.detail.contactPrefill(listing.title);
    getOrCreateDm.mutate(listing.seller_id, {
      onSuccess: (conversationId) => {
        // L'écran de conversation lira `prefill` au mount et pré-remplira le
        // composer SANS auto-envoyer. L'user édite puis envoie quand il veut.
        router.push({
          pathname: '/messages/[id]',
          params: { id: conversationId, prefill },
        });
      },
      onError: (err) => {
        logger.warn('Contact seller failed', { message: err.message });
        Alert.alert(
          t.marketplace.detail.contactErrorTitle,
          err.message || t.marketplace.detail.contactErrorFallback
        );
      },
    });
  }, [getOrCreateDm, isMyListing, listing, t]);

  // Header (toujours rendu pour permettre le retour même en erreur/loading)
  const renderHeader = (
    <XStack
      position="absolute"
      top={insets.top + 8}
      left={0}
      right={0}
      paddingHorizontal={12}
      justifyContent="space-between"
      zIndex={10}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t.marketplace.common.back}
        style={styles.headerButton}
      >
        <ArrowLeft size={22} color="#FFFFFF" />
      </Pressable>
      {listing ? (
        <Pressable
          onPress={handleToggleBookmark}
          disabled={toggleBookmark.isPending}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            listing.bookmarked_by_me ? t.marketplace.bookmark.remove : t.marketplace.bookmark.add
          }
          accessibilityState={{ selected: listing.bookmarked_by_me }}
          style={styles.headerButton}
        >
          <Bookmark
            size={22}
            color={listing.bookmarked_by_me ? '#10D970' : '#FFFFFF'}
            fill={listing.bookmarked_by_me ? '#10D970' : 'transparent'}
            strokeWidth={2.2}
          />
        </Pressable>
      ) : null}
    </XStack>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View flex={1} backgroundColor="$background">
          {renderHeader}
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator color="#FFFFFF" />
          </YStack>
        </View>
      </>
    );
  }

  if (isError || !listing) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {renderHeader}
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal={24}
            gap={8}
          >
            <Text fontSize={16} fontWeight="700" color="$color">
              {t.marketplace.detail.notFoundTitle}
            </Text>
            <Text fontSize={13} color="$textSecondary" textAlign="center">
              {t.marketplace.detail.notFoundSubtitle}
            </Text>
            <Button
              marginTop={12}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="700"
              borderRadius="$10"
              onPress={handleBack}
            >
              {t.marketplace.common.back}
            </Button>
          </YStack>
        </View>
      </>
    );
  }

  const conditionLabel = listing.condition ? t.marketplace.condition[listing.condition] : null;
  const badgeLabel = listing.badge ? t.marketplace.badge[listing.badge] : null;
  const badgeColors = listing.badge ? BADGE_COLORS[listing.badge] : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View flex={1} backgroundColor="$background">
        {renderHeader}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Carousel */}
          <ListingImageCarousel
            images={listing.images}
            accessibilityLabelBase={t.marketplace.detail.imageA11y(listing.title)}
          />

          <YStack paddingHorizontal={16} paddingTop={16} gap={12}>
            {/* Badge promo */}
            {badgeLabel && badgeColors ? (
              <View alignSelf="flex-start">
                <View
                  backgroundColor={badgeColors.bg}
                  paddingHorizontal={10}
                  paddingVertical={4}
                  borderRadius={9999}
                >
                  <Text fontSize={11} fontWeight="700" color={badgeColors.text}>
                    {badgeLabel}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Titre */}
            <Text fontSize={22} fontWeight="800" color="$color">
              {listing.title}
            </Text>

            {/* Prix actuel + prix barré */}
            <XStack alignItems="baseline" gap={10} flexWrap="wrap">
              {priceCurrent ? (
                <Text fontSize={26} fontWeight="900" color="$accentNeon">
                  {priceCurrent}
                </Text>
              ) : null}
              {priceOriginal ? (
                <Text fontSize={16} color="$textSecondary" textDecorationLine="line-through">
                  {priceOriginal}
                </Text>
              ) : null}
              {listing.discount_percent ? (
                <View
                  backgroundColor="#E53935"
                  paddingHorizontal={8}
                  paddingVertical={3}
                  borderRadius={6}
                >
                  <Text fontSize={12} fontWeight="700" color="#FFFFFF">
                    -{listing.discount_percent}%
                  </Text>
                </View>
              ) : null}
            </XStack>

            {/* État + localisation + date + vues */}
            <XStack flexWrap="wrap" gap={8} alignItems="center">
              {conditionLabel ? (
                <View
                  backgroundColor="$surface"
                  paddingHorizontal={10}
                  paddingVertical={4}
                  borderRadius={6}
                >
                  <Text fontSize={12} fontWeight="600" color="$color">
                    {conditionLabel}
                  </Text>
                </View>
              ) : null}
              {listing.location ? (
                <XStack alignItems="center" gap={4}>
                  <MapPin size={14} color="#A0A0A0" />
                  <Text fontSize={12} color="$textSecondary" numberOfLines={1}>
                    {listing.location}
                  </Text>
                </XStack>
              ) : null}
              <Text fontSize={12} color="$textSecondary">
                {formatRelative(listing.created_at)}
              </Text>
              <XStack alignItems="center" gap={4}>
                <Eye size={12} color="#A0A0A0" />
                <Text fontSize={12} color="$textSecondary">
                  {t.marketplace.detail.views(listing.view_count)}
                </Text>
              </XStack>
            </XStack>

            {/* Description */}
            {listing.description ? (
              <YStack gap={6} paddingTop={4}>
                <Text fontSize={13} color="$textSecondary" fontWeight="700">
                  {t.marketplace.detail.descriptionLabel}
                </Text>
                <Text fontSize={14} color="$color" lineHeight={20}>
                  {listing.description}
                </Text>
              </YStack>
            ) : null}

            {/* Carte vendeur */}
            <YStack gap={8} paddingTop={4}>
              <Text fontSize={13} color="$textSecondary" fontWeight="700">
                {t.marketplace.detail.sellerLabel}
              </Text>
              <SellerCard
                seller={{
                  id: listing.seller_id,
                  username: listing.seller_username,
                  full_name: listing.seller_full_name,
                  avatar_url: listing.seller_avatar_url,
                  is_verified: listing.seller_is_verified,
                }}
                onPress={handleOpenSeller}
              />
            </YStack>
          </YStack>

          {/* Annonces similaires */}
          {similar.length > 0 ? (
            <YStack paddingTop={20}>
              <SimilarListingsRow listings={similar} onPressItem={handlePressSimilar} />
            </YStack>
          ) : null}
        </ScrollView>

        {/* CTA sticky bottom — E7-13 */}
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          paddingHorizontal={16}
          paddingTop={12}
          paddingBottom={insets.bottom + 12}
          backgroundColor="$background"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderColor"
        >
          {isMyListing ? (
            <Pressable
              onPress={handleBoost}
              disabled={boost.isPending}
              accessibilityRole="button"
              accessibilityLabel={t.marketplace.boost.cta}
              accessibilityState={{ disabled: boost.isPending }}
              style={[styles.cta, { backgroundColor: boost.isPending ? '#1A1A1A' : '#10D970' }]}
            >
              {boost.isPending ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <XStack alignItems="center" gap={8}>
                  <Rocket size={18} color="#000000" />
                  <Text fontSize={15} fontWeight="800" color="#000000">
                    {t.marketplace.boost.cta} · {LISTING_BOOST_COST} Dcoins
                  </Text>
                </XStack>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleContactSeller}
              disabled={getOrCreateDm.isPending}
              accessibilityRole="button"
              accessibilityLabel={t.marketplace.detail.contactSellerA11y(listing.seller_username)}
              accessibilityHint={t.marketplace.detail.contactSellerHint}
              accessibilityState={{ disabled: getOrCreateDm.isPending }}
              style={[
                styles.cta,
                { backgroundColor: getOrCreateDm.isPending ? '#1A1A1A' : '#10D970' },
              ]}
            >
              {getOrCreateDm.isPending ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color="#000000">
                  {t.marketplace.detail.contactSellerCta}
                </Text>
              )}
            </Pressable>
          )}
        </YStack>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
