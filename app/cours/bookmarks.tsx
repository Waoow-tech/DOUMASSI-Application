// Écran Favoris Cours — E9-07 (#267)
//
// Liste des ressources sauvegardées. Réutilise ResourceCard (même UX que la
// bibliothèque). Pull to refresh + infinite scroll + empty state.

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, BookmarkX } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ResourceCard } from '@/features/cours/components/ResourceCard';
import { useBookmarkedResources } from '@/features/cours/hooks/useBookmarkedResources';
import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import {
  useToggleResourceBookmark,
  type ResourceListItem,
} from '@/features/cours/hooks/useResources';
import { useTranslations } from '@/i18n';

export default function CoursBookmarksScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ResourceListItem>>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const bookmarksQuery = useBookmarkedResources();
  const toggleBookmark = useToggleResourceBookmark();
  const levelsQuery = useCourseLevels();
  const subjectsQuery = useCourseSubjects();

  const levelLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    (levelsQuery.data ?? []).forEach((l) => m.set(l.code, l.label));
    return m;
  }, [levelsQuery.data]);
  const subjectLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    (subjectsQuery.data ?? []).forEach((s) => m.set(s.code, s.label));
    return m;
  }, [subjectsQuery.data]);

  const allResources = useMemo<ResourceListItem[]>(
    () => bookmarksQuery.data?.pages.flatMap((p) => p.resources) ?? [],
    [bookmarksQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const handleCardPress = useCallback((id: string) => {
    router.push(`/cours/${id}`);
  }, []);

  const handleToggleBookmark = useCallback(
    (id: string) => {
      // Refetch onSettled pour que l'item disparaisse immédiatement de la
      // liste des favoris après un unbookmark (sinon flicker 1-2s).
      toggleBookmark.mutate({ resourceId: id }, { onSettled: () => void bookmarksQuery.refetch() });
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

  const renderItem = useCallback(
    ({ item }: { item: ResourceListItem }) => (
      <View paddingHorizontal={12} paddingBottom={10}>
        <ResourceCard
          resource={item}
          levelLabel={levelLabelByCode.get(item.level_code) ?? item.level_code}
          subjectLabel={subjectLabelByCode.get(item.subject_code) ?? item.subject_code}
          onPress={() => handleCardPress(item.id)}
          onToggleBookmark={() => handleToggleBookmark(item.id)}
          isBookmarkPending={toggleBookmark.isPending}
        />
      </View>
    ),
    [
      levelLabelByCode,
      subjectLabelByCode,
      handleCardPress,
      handleToggleBookmark,
      toggleBookmark.isPending,
    ]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
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
            accessibilityLabel={t.cours.common.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            {t.cours.bookmarks.title}
          </Text>
        </XStack>

        <View flex={1}>
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
                {t.cours.bookmarks.errorTitle}
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {t.cours.common.pullToRetry}
              </Text>
            </YStack>
          ) : allResources.length === 0 ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={12}
            >
              <BookmarkX size={48} color="#666" strokeWidth={1.5} />
              <Text fontSize={16} fontWeight="700" color="$color" textAlign="center">
                {t.cours.bookmarks.emptyTitle}
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {t.cours.bookmarks.emptySubtitle}
              </Text>
              <Pressable
                onPress={() => router.replace('/cours')}
                accessibilityRole="button"
                accessibilityLabel={t.cours.bookmarks.exploreCta}
                style={styles.cta}
              >
                <Text fontSize={14} fontWeight="800" color="#000000">
                  {t.cours.bookmarks.exploreCta}
                </Text>
              </Pressable>
            </YStack>
          ) : (
            <FlashList
              ref={listRef}
              data={allResources}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingTop: 6,
    paddingBottom: 24,
  },
});
