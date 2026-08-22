// E4-07 — Écran /bookmarks : liste paginée des posts sauvegardés par l'user.
// Réutilise PostCard (E4-02) ; les actions like / bookmark passent par
// useToggleFeedLike / useToggleFeedBookmark (cf. useFeed.ts), qui font
// déjà l'update optimiste — et qui invalident ['bookmarks'] pour que
// l'écran se rafraîchisse quand on un-bookmark un post depuis ici.

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ArrowLeft, Bookmark } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, Text, XStack, YStack } from 'tamagui';

import { PostCard, PostCardSkeleton, type PostCardPost } from '@/components/feed/PostCard';
import { useBookmarks } from '@/features/feed/hooks/useBookmarks';
import { useToggleFeedBookmark, useToggleFeedLike } from '@/features/feed/hooks/useFeed';
import { useTranslations } from '@/i18n';

function BookmarksHeader() {
  const t = useTranslations();

  return (
    <XStack
      alignItems="center"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
    >
      <YStack
        onPress={() => router.back()}
        pressStyle={{ opacity: 0.6 }}
        padding="$2"
        width={40}
        accessibilityRole="button"
        accessibilityLabel={t.feed.bookmarks.back}
      >
        <ArrowLeft size={24} color="#FFFFFF" />
      </YStack>
      <Text flex={1} textAlign="center" color="$color" fontSize={17} fontWeight="700">
        {t.feed.bookmarks.title}
      </Text>
      {/* spacer pour centrer le titre malgré le bouton retour à gauche */}
      <YStack width={40} />
    </XStack>
  );
}

function BookmarksEmptyState() {
  const t = useTranslations();

  return (
    <YStack alignItems="center" justifyContent="center" padding="$6" gap="$3" marginTop="$10">
      <Bookmark size={40} color="#A0A0A0" />
      <Text color="$color" fontSize={17} fontWeight="700" textAlign="center">
        {t.feed.bookmarks.emptyTitle}
      </Text>
      <Text color="$textSecondary" fontSize={14} textAlign="center" maxWidth={280}>
        {t.feed.bookmarks.emptySubtitle}
      </Text>
    </YStack>
  );
}

function BookmarksFooter({ isFetchingNextPage }: { isFetchingNextPage: boolean }) {
  if (!isFetchingNextPage) return null;
  return (
    <YStack paddingVertical="$5" alignItems="center">
      <Spinner color="$color" />
    </YStack>
  );
}

export function BookmarksScreen() {
  const bookmarksQuery = useBookmarks();
  const likeMutation = useToggleFeedLike();
  const bookmarkMutation = useToggleFeedBookmark();

  const posts = bookmarksQuery.data?.pages.flatMap((page) => page.posts) ?? [];

  const renderPost = useCallback(
    ({ item }: { item: PostCardPost }) => (
      <PostCard
        post={item}
        onLike={() => likeMutation.mutate(item.id)}
        onBookmark={() => bookmarkMutation.mutate(item.id)}
        onOpenDetail={() => router.push(`/post/${item.id}`)}
        onOpenComments={() => router.push(`/post/${item.id}?focus=comments`)}
        onOpenProfile={() => router.push(`/profile/${item.author_id}`)}
      />
    ),
    [bookmarkMutation, likeMutation]
  );

  const keyExtractor = useCallback((item: PostCardPost) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BookmarksHeader />
      <FlashList<PostCardPost>
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        ListEmptyComponent={
          bookmarksQuery.isLoading ? (
            <YStack>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </YStack>
          ) : (
            <BookmarksEmptyState />
          )
        }
        ListFooterComponent={
          <BookmarksFooter isFetchingNextPage={bookmarksQuery.isFetchingNextPage} />
        }
        onEndReached={() => {
          if (bookmarksQuery.hasNextPage && !bookmarksQuery.isFetchingNextPage) {
            void bookmarksQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.8}
        onRefresh={() => void bookmarksQuery.refetch()}
        refreshing={bookmarksQuery.isRefetching && !bookmarksQuery.isFetchingNextPage}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  listContent: { backgroundColor: '#000000', paddingBottom: 32 },
});
