// Écran Marketplace — grille — E7-10
//
// Cf brief Marketplace L0 du 29/06 + maquette CEO.
// Header retour + titre 'Boutique' + bookmark icon (→ E7-16 à venir).
// Barre de filtres rapides + chips de catégorie + recherche live.
// Grille 2 colonnes (FlashList) + pull-to-refresh + infinite scroll.
//
// PAS de bandeau "Bientôt disponible" sur cet écran (ce sera l'écran Business
// principal qui le porte si on l'ajoute plus tard).

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Bookmark, Plus, Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, View, XStack, YStack } from 'tamagui';

import { AdvancedFiltersSheet } from '@/features/marketplace/components/AdvancedFiltersSheet';
import { CategoryChips } from '@/features/marketplace/components/CategoryChips';
import { ListingCard } from '@/features/marketplace/components/ListingCard';
import { QuickFiltersBar } from '@/features/marketplace/components/QuickFiltersBar';
import {
  useListings,
  useToggleListingBookmark,
  type ListingCard as ListingCardData,
  type ListingCategory,
  type ListingCondition,
  type ListingSort,
  type ListingsFilters,
} from '@/features/marketplace/hooks/useListings';
import { useTranslations } from '@/i18n';

const GRID_GAP = 8;
const NUM_COLUMNS = 2;
const GUTTER = 12;

export default function MarketplaceGridScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlashListRef<ListingCardData>>(null);

  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // E7-11 — filtres avancés (modale)
  const [sort, setSort] = useState<ListingSort>('recent');
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [minPriceCents, setMinPriceCents] = useState<number | null>(null);
  const [maxPriceCents, setMaxPriceCents] = useState<number | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const filters = useMemo<ListingsFilters>(
    () => ({
      category,
      sort,
      condition,
      minPriceCents,
      maxPriceCents,
    }),
    [category, sort, condition, minPriceCents, maxPriceCents]
  );

  // Pour le badge "filtres actifs" du bouton réglages : on considère qu'un
  // filtre est "avancé" dès qu'il sort de la config par défaut.
  const hasActiveAdvancedFilters =
    sort !== 'recent' || condition != null || minPriceCents != null || maxPriceCents != null;

  const listingsQuery = useListings(filters);
  const toggleBookmark = useToggleListingBookmark();

  // Aplatissement des pages + filtre texte client (MVP). Si > 200 listings,
  // basculer en filtre serveur via un paramètre p_query dans get_listings
  // (note pour follow-up).
  const allListings = useMemo<ListingCardData[]>(() => {
    const pages = listingsQuery.data?.pages ?? [];
    const flat = pages.flatMap((p) => p.listings);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q) ||
        (l.location ?? '').toLowerCase().includes(q)
    );
  }, [listingsQuery.data, searchQuery]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleOpenBookmarks = useCallback(() => {
    // E7-16 livrera l'écran /shop/bookmarks
    router.push('/shop/bookmarks');
  }, []);

  const handleOpenCreate = useCallback(() => {
    router.push('/shop/create');
  }, []);

  const handleOpenAdvanced = useCallback(() => {
    setIsFiltersOpen(true);
  }, []);

  const handleApplyAdvancedFilters = useCallback(
    (next: Pick<ListingsFilters, 'sort' | 'condition' | 'minPriceCents' | 'maxPriceCents'>) => {
      setSort(next.sort ?? 'recent');
      setCondition(next.condition ?? null);
      setMinPriceCents(next.minPriceCents ?? null);
      setMaxPriceCents(next.maxPriceCents ?? null);
    },
    []
  );

  const handleCardPress = useCallback((listingId: string) => {
    // E7-12 livrera la fiche produit
    router.push(`/shop/${listingId}`);
  }, []);

  const handleToggleBookmark = useCallback(
    (listingId: string) => {
      toggleBookmark.mutate({ listingId });
    },
    [toggleBookmark]
  );

  const handleLoadMore = useCallback(() => {
    if (listingsQuery.hasNextPage && !listingsQuery.isFetchingNextPage) {
      void listingsQuery.fetchNextPage();
    }
  }, [listingsQuery]);

  const handlePullToRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await listingsQuery.refetch();
    setIsManualRefreshing(false);
  }, [listingsQuery]);

  const cardWidth = useMemo(
    () => (screenWidth - GUTTER * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS,
    [screenWidth]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ListingCardData; index: number }) => {
      const isLeftColumn = index % NUM_COLUMNS === 0;
      return (
        <View width={cardWidth} marginRight={isLeftColumn ? GRID_GAP : 0} marginBottom={GRID_GAP}>
          <ListingCard
            listing={item}
            onPress={() => handleCardPress(item.id)}
            onToggleBookmark={() => handleToggleBookmark(item.id)}
            isBookmarkPending={toggleBookmark.isPending}
          />
        </View>
      );
    },
    [cardWidth, handleCardPress, handleToggleBookmark, toggleBookmark.isPending]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {/* Header */}
        <XStack
          height={56}
          paddingHorizontal={12}
          alignItems="center"
          gap={12}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.marketplace.common.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            {t.marketplace.grid.title}
          </Text>
          <Pressable
            onPress={handleOpenBookmarks}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.marketplace.grid.bookmarksA11yLabel}
            accessibilityHint={t.marketplace.grid.bookmarksA11yHint}
          >
            <Bookmark size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={handleOpenCreate}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.marketplace.grid.createA11yLabel}
            accessibilityHint={t.marketplace.grid.createA11yHint}
            style={styles.createButton}
          >
            <Plus size={20} color="#000000" strokeWidth={2.6} />
          </Pressable>
        </XStack>

        {/* Recherche */}
        <YStack paddingHorizontal={12} paddingTop={10}>
          <XStack
            alignItems="center"
            gap={8}
            height={44}
            backgroundColor="$surface"
            borderRadius="$md"
            paddingHorizontal={12}
          >
            <Search size={18} color="#A0A0A0" />
            <Input
              flex={1}
              height={44}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder={t.marketplace.grid.searchPlaceholder}
              placeholderTextColor="$placeholderColor"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              fontSize={15}
              paddingHorizontal={0}
              accessibilityLabel={t.marketplace.grid.searchA11yLabel}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t.marketplace.grid.clearSearchA11yLabel}
              >
                <X size={16} color="#A0A0A0" />
              </Pressable>
            ) : null}
          </XStack>
        </YStack>

        {/* Filtres rapides */}
        <QuickFiltersBar
          onOpenAdvanced={handleOpenAdvanced}
          hasActiveAdvancedFilters={hasActiveAdvancedFilters}
        />

        {/* Chips catégorie */}
        <CategoryChips selected={category} onSelect={setCategory} />

        {/* Grille listings */}
        <View flex={1} paddingHorizontal={GUTTER}>
          {listingsQuery.isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : listingsQuery.isError ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={8}
            >
              <Text fontSize={16} fontWeight="700" color="$color">
                {t.marketplace.grid.errorTitle}
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {t.marketplace.common.pullToRetry}
              </Text>
            </YStack>
          ) : allListings.length === 0 ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={8}
            >
              <Text fontSize={16} fontWeight="700" color="$color">
                {t.marketplace.grid.emptyTitle}
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {searchQuery.length > 0
                  ? t.marketplace.grid.emptySearch(searchQuery)
                  : t.marketplace.grid.emptyNoFilters}
              </Text>
            </YStack>
          ) : (
            <FlashList
              ref={listRef}
              data={allListings}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.gridContent}
              refreshControl={
                <RefreshControl
                  refreshing={isManualRefreshing}
                  onRefresh={() => void handlePullToRefresh()}
                  tintColor="#10D970"
                  colors={['#10D970']}
                />
              }
              ListFooterComponent={
                listingsQuery.isFetchingNextPage ? (
                  <YStack paddingVertical={16} alignItems="center">
                    <ActivityIndicator color="#FFFFFF" />
                  </YStack>
                ) : null
              }
            />
          )}
        </View>
      </YStack>

      <AdvancedFiltersSheet
        open={isFiltersOpen}
        onOpenChange={setIsFiltersOpen}
        current={filters}
        activeCategory={category}
        onApply={handleApplyAdvancedFilters}
      />
    </>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10D970',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
});
