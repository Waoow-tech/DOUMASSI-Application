// Écran Mon fil Cours — E9-14 (#274)
//
// Ressources des matières/niveaux suivis, triées par récence. Réutilise
// ResourceCard. Empty state qui invite à suivre des matières depuis Apprendre.

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Rss } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { ResourceCard } from '@/features/cours/components/ResourceCard';
import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import { useFollowedResources } from '@/features/cours/hooks/useCoursFollows';
import {
  useToggleResourceBookmark,
  type ResourceListItem,
} from '@/features/cours/hooks/useResources';

export default function CoursFeedScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ResourceListItem>>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const feedQuery = useFollowedResources();
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
    () => feedQuery.data?.pages.flatMap((p) => p.resources) ?? [],
    [feedQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const handlePullToRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await feedQuery.refetch();
    setIsManualRefreshing(false);
  }, [feedQuery]);

  const handleLoadMore = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ResourceListItem }) => (
      <View paddingHorizontal={12} paddingBottom={10}>
        <ResourceCard
          resource={item}
          levelLabel={levelLabelByCode.get(item.level_code) ?? item.level_code}
          subjectLabel={subjectLabelByCode.get(item.subject_code) ?? item.subject_code}
          onPress={() => router.push(`/cours/${item.id}`)}
          onToggleBookmark={() => toggleBookmark.mutate({ resourceId: item.id })}
          isBookmarkPending={toggleBookmark.isPending}
        />
      </View>
    ),
    [levelLabelByCode, subjectLabelByCode, toggleBookmark]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <View
          height={56}
          paddingHorizontal={12}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
          justifyContent="center"
        >
          <View flexDirection="row" alignItems="center" gap={12}>
            <Pressable
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text flex={1} color="$color" fontSize={18} fontWeight="700">
              Mon fil
            </Text>
          </View>
        </View>

        <View flex={1}>
          {feedQuery.isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : allResources.length === 0 ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={12}
            >
              <Rss size={48} color="#666" strokeWidth={1.5} />
              <Text fontSize={16} fontWeight="700" color="$color" textAlign="center">
                Ton fil est vide
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                Suis des matières depuis l&apos;écran Apprendre pour voir leurs nouvelles ressources
                ici.
              </Text>
              <Pressable
                onPress={() => router.replace('/cours')}
                accessibilityRole="button"
                accessibilityLabel="Découvrir des matières"
                style={styles.cta}
              >
                <Text fontSize={14} fontWeight="800" color="#000000">
                  Découvrir des matières
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
                  tintColor="#10D970"
                  colors={['#10D970']}
                />
              }
              ListFooterComponent={
                feedQuery.isFetchingNextPage ? (
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
    backgroundColor: '#10D970',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: 24,
  },
});
