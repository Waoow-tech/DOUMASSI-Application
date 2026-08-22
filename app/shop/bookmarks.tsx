// Écran Favoris Marketplace — E7-16 (#247)
//
// Liste paginée des annonces que l'user a mises en favori. Réutilise
// ListingCard (donc même UX que la grille principale, à un seul détail
// près : ici TOUS les items ont bookmarked_by_me=true par construction).
//
// Pull to refresh + infinite scroll + empty state quand l'user n'a encore
// rien sauvegardé.

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, BookmarkX } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ListingCard } from '@/features/marketplace/components/ListingCard';
import { useBookmarkedListings } from '@/features/marketplace/hooks/useBookmarkedListings';
import {
  useToggleListingBookmark,
  type ListingCard as ListingCardData,
} from '@/features/marketplace/hooks/useListings';
import { useTranslations } from '@/i18n';

const GRID_GAP = 8;
const NUM_COLUMNS = 2;
const GUTTER = 12;

export default function BookmarksScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlashListRef<ListingCardData>>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const bookmarksQuery = useBookmarkedListings();
  const toggleBookmark = useToggleListingBookmark();

  const allListings = useMemo<ListingCardData[]>(
    () => bookmarksQuery.data?.pages.flatMap((p) => p.listings) ?? [],
    [bookmarksQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/shop');
  }, []);

  const handleCardPress = useCallback((listingId: string) => {
    router.push(`/shop/${listingId}`);
  }, []);

  const handleToggleBookmark = useCallback(
    (listingId: string) => {
      // L'optimistic update du hook flip bookmarked_by_me partout, donc
      // l'item disparaitra de cette liste au prochain refetch. On déclenche
      // manuellement le refetch pour que l'effet soit immédiat à l'écran
      // (sinon l'user voit un item "non-bookmarked" pendant 1-2 sec).
      toggleBookmark.mutate({ listingId }, { onSettled: () => void bookmarksQuery.refetch() });
    },
    [bookmarksQuery, toggleBookmark]
  );

  const handleLoadMore = useCallback(() => {
    if (bookmarksQuery.hasNextPage && !bookmarksQuery.isFetchingNextPage) {
      void bookmarksQuery.fetchNextPage();
    }
  }, [bookmarksQuery]);

  const handlePullToRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await bookmarksQuery.refetch();
    setIsManualRefreshing(false);
  }, [bookmarksQuery]);

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
            {t.marketplace.bookmarks.title}
          </Text>
        </XStack>

        {/* Grid */}
        <View flex={1} paddingHorizontal={GUTTER}>
          {bookmarksQuery.isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : bookmarksQuery.isError ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={8}
            >
              <Text fontSize={16} fontWeight="700" color="$color">
                {t.marketplace.bookmarks.errorTitle}
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
              gap={12}
            >
              <BookmarkX size={48} color="#666" strokeWidth={1.5} />
              <Text fontSize={16} fontWeight="700" color="$color" textAlign="center">
                {t.marketplace.bookmarks.emptyTitle}
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {t.marketplace.bookmarks.emptySubtitle}
              </Text>
              <Pressable
                onPress={() => router.replace('/shop')}
                accessibilityRole="button"
                accessibilityLabel={t.marketplace.bookmarks.discoverCta}
                style={styles.cta}
              >
                <Text fontSize={14} fontWeight="800" color="#000000">
                  {t.marketplace.bookmarks.discoverCta}
                </Text>
              </Pressable>
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
                  tintColor="#FFFFFF"
                  colors={['#FFFFFF']}
                />
              }
              ListFooterComponent={
                bookmarksQuery.isFetchingNextPage ? (
                  <YStack paddingVertical={16} alignItems="center">
                    <ActivityIndicator color="#FFFFFF" />
                  </YStack>
                ) : null
              }
            />
          )}
        </View>
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  cta: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  gridContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
});
