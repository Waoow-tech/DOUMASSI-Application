import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Rocket,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Store,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';

import { PostCard, PostCardSkeleton, type PostCardPost } from '@/components/feed/PostCard';
import { PostMenuSheet } from '@/components/feed/PostMenuSheet';
import { BusinessHub } from '@/features/feed/components/BusinessHub';
import { FeedStories } from '@/features/feed/components/FeedStories';
import { FeedTabPlaceholder } from '@/features/feed/components/FeedTabPlaceholder';
import { useDeletePost } from '@/features/feed/hooks/useDeletePost';
import { useFeed, useToggleFeedBookmark, useToggleFeedLike } from '@/features/feed/hooks/useFeed';
import { type FeedStory, useFeedStories } from '@/features/feed/hooks/useFeedStories';
import { useUnhidePost } from '@/features/feed/hooks/useHiddenPosts';
import { SearchBar } from '@/features/profile/components/SearchBar';
import { useTranslations } from '@/i18n';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../../../assets/Logo-Doumassi.webp') as number;

type FeedTabId = 'social' | 'business' | 'ai' | 'wallet' | 'soon';

type FeedToast = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const FEED_TABS: FeedTabId[] = ['social', 'business', 'ai', 'wallet', 'soon'];

// Icônes des placeholders des onglets pas encore livrés. Les libellés
// (titre / sous-titre / manifest) sont fournis par le dico i18n côté composant.
const PLACEHOLDER_ICONS = {
  business: Store,
  ai: Sparkles,
  wallet: Wallet,
  soon: Rocket,
} satisfies Record<Exclude<FeedTabId, 'social'>, LucideIcon>;

function FeedHeader({
  activeTab,
  searchValue,
  onSearchChange,
  onTabPress,
}: {
  activeTab: FeedTabId;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onTabPress: (tab: FeedTabId) => void;
}) {
  const t = useTranslations();

  return (
    <YStack backgroundColor="$background" paddingTop="$3" paddingBottom="$2">
      <XStack alignItems="center" justifyContent="center" paddingHorizontal="$4" height={42}>
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          activeOpacity={0.65}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={styles.headerSideButton}
          accessibilityRole="button"
          accessibilityLabel={t.feed.screen.openProfileA11y}
        >
          <User size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <YStack flex={1} alignItems="center">
          <Image source={logoSource} style={styles.logo} contentFit="contain" transition={200} />
        </YStack>

        <TouchableOpacity
          onPress={() => router.push('/settings')}
          activeOpacity={0.65}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={styles.headerSideButton}
          accessibilityRole="button"
          accessibilityLabel={t.feed.screen.openSettingsA11y}
        >
          <Settings size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </XStack>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {FEED_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const label = t.feed.tabs[tab];
          return (
            <YStack
              key={tab}
              height={36}
              paddingHorizontal={14}
              borderRadius={18}
              backgroundColor={isActive ? '#FFFFFF' : '$surface'}
              alignItems="center"
              justifyContent="center"
              onPress={() => onTabPress(tab)}
              pressStyle={{ scale: 0.97 }}
              accessibilityRole="button"
              accessibilityLabel={t.feed.tabs.openTabA11y(label)}
            >
              <Text
                color={isActive ? '#000000' : '$textSecondary'}
                fontSize={14}
                fontWeight={isActive ? '700' : '500'}
              >
                {label}
              </Text>
            </YStack>
          );
        })}
      </ScrollView>

      <SearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={
          activeTab === 'social'
            ? t.feed.screen.searchPostsPlaceholder
            : t.feed.screen.searchPlaceholder
        }
      />
    </YStack>
  );
}

function FeedEmptyState() {
  const t = useTranslations();

  return (
    <YStack alignItems="center" justifyContent="center" padding="$6" gap="$3">
      <Search size={34} color="#A0A0A0" />
      <Text color="$color" fontSize={17} fontWeight="700" textAlign="center">
        {t.feed.screen.emptyTitle}
      </Text>
      <Button
        height={42}
        borderRadius="$lg"
        backgroundColor="$color"
        color="$background"
        fontWeight="700"
        onPress={() => router.push('/search')}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
      >
        {t.feed.screen.emptyDiscover}
      </Button>
    </YStack>
  );
}

function FeedFooter({ isFetchingNextPage }: { isFetchingNextPage: boolean }) {
  if (!isFetchingNextPage) return null;

  return (
    <YStack paddingVertical="$5" alignItems="center">
      <Spinner color="$color" />
    </YStack>
  );
}

export function FeedScreen() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<FeedTabId>('social');
  const [searchValue, setSearchValue] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostCardPost | null>(null);
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const [toast, setToast] = useState<FeedToast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollOffsets = useRef<Record<FeedTabId, number>>({
    social: 0,
    business: 0,
    ai: 0,
    wallet: 0,
    soon: 0,
  });
  const socialListRef = useRef<FlashListRef<PostCardPost>>(null);
  const placeholderScrollRef = useRef<ScrollView>(null);

  const feedQuery = useFeed();
  const storiesQuery = useFeedStories();
  const likeMutation = useToggleFeedLike();
  const bookmarkMutation = useToggleFeedBookmark();
  const deletePostMutation = useDeletePost();
  const unhidePostMutation = useUnhidePost();

  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [feedQuery.data]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });
  }, []);

  const showToast = useCallback((nextToast: FeedToast, durationMs = 1800) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(nextToast);
    toastTimeoutRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    },
    []
  );

  const restoreScroll = useCallback((tab: FeedTabId) => {
    requestAnimationFrame(() => {
      const offset = scrollOffsets.current[tab] ?? 0;
      if (tab === 'social') {
        socialListRef.current?.scrollToOffset({ offset, animated: false });
        return;
      }

      placeholderScrollRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, []);

  const handleTabPress = useCallback(
    (tab: FeedTabId) => {
      // Onglets qui pointent vers une feature LIVRÉE : on ouvre le vrai écran
      // au lieu d'un placeholder « bientôt disponible ». Wallet (E12) et
      // Doumassi AI (E5-03, l'onglet # en bas) existent — pas de faux « bientôt ».
      if (tab === 'wallet') {
        router.push('/wallet');
        return;
      }
      if (tab === 'ai') {
        router.push('/studio-ai');
        return;
      }
      setActiveTab(tab);
      restoreScroll(tab);
    },
    [restoreScroll]
  );

  const handleSocialScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsets.current.social = event.nativeEvent.contentOffset.y;
  }, []);

  const handlePlaceholderScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsets.current[activeTab] = event.nativeEvent.contentOffset.y;
    },
    [activeTab]
  );

  const handleStoryPress = useCallback((story: FeedStory) => {
    // E4-13 : si la story est la mienne et qu'elle a `hasUnseenStory` à
    // false (= pas de story active ou toutes vues), j'ouvre l'écran de
    // création. Sinon je vais à la visionneuse pour voir mes stories ou
    // celles d'un autre user.
    if (story.isMe && !story.hasUnseenStory) {
      router.push('/story/create');
      return;
    }
    router.push(`/story/${story.id}`);
  }, []);

  const handleMenuPress = useCallback((post: PostCardPost) => {
    setSelectedPost(post);
    setIsPostMenuOpen(true);
  }, []);

  const handleMenuShare = useCallback(async () => {
    if (!selectedPost) return;

    try {
      const result = await Share.share({ message: `https://doumassi.app/post/${selectedPost.id}` });
      if (result.action === Share.sharedAction) {
        await supabase.rpc('increment_share_count', { p_post_id: selectedPost.id });
      }
    } catch {
      showToast({ message: t.feed.screen.toastShareFailed });
    }
  }, [selectedPost, showToast, t]);

  const handleDeleteSelectedPost = useCallback(async () => {
    if (!selectedPost) return;

    try {
      await deletePostMutation.mutateAsync(selectedPost.id);
      showToast({ message: t.feed.screen.toastPostDeleted });
    } catch {
      showToast({ message: t.feed.screen.toastDeleteFailed });
      throw new Error('Delete post failed');
    }
  }, [deletePostMutation, selectedPost, showToast, t]);

  const handleHiddenSelectedPost = useCallback(() => {
    if (!selectedPost) return;
    const hiddenPostId = selectedPost.id;

    showToast(
      {
        message: t.feed.screen.toastPostHidden,
        actionLabel: t.feed.screen.undo,
        onAction: () => {
          unhidePostMutation.mutate(hiddenPostId, {
            onSuccess: () => showToast({ message: t.feed.screen.toastDisplayRestored }),
          });
        },
      },
      5000
    );
  }, [selectedPost, showToast, unhidePostMutation, t]);

  const renderPost = useCallback(
    ({ item }: { item: PostCardPost }) => (
      <PostCard
        post={item}
        onLike={() => likeMutation.mutate(item.id)}
        onBookmark={() => bookmarkMutation.mutate(item.id)}
        // Une vidéo ouvre le défilement plein écran (E14-02) et non la fiche
        // du post : on enchaîne alors sur les vidéos suivantes. Les posts
        // image gardent l'écran de détail classique.
        onOpenDetail={() =>
          item.media_type === 'video'
            ? router.push(`/videos?postId=${item.id}`)
            : router.push(`/post/${item.id}`)
        }
        onOpenComments={() => router.push(`/post/${item.id}?focus=comments`)}
        onOpenProfile={() => router.push(`/profile/${item.author_id}`)}
        onMenuPress={() => handleMenuPress(item)}
      />
    ),
    [bookmarkMutation, handleMenuPress, likeMutation]
  );

  const keyExtractor = useCallback((item: PostCardPost) => item.id, []);

  const socialHeader = (
    <>
      <FeedHeader
        activeTab={activeTab}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onTabPress={handleTabPress}
      />
      <FeedStories stories={storiesQuery.data ?? []} onStoryPress={handleStoryPress} />
    </>
  );

  if (activeTab !== 'social') {
    // E7-17 — l'onglet Business affiche le vrai Hub (grille catégories).
    // Les autres onglets (ai/wallet/soon) restent en placeholder jusqu'à
    // ce que les épiques correspondantes soient livrées.
    const isBusinessHub = activeTab === 'business';
    const placeholder = isBusinessHub
      ? null
      : {
          Icon: PLACEHOLDER_ICONS[activeTab],
          title: t.feed.tabs.placeholders[activeTab].title,
          subtitle: t.feed.tabs.placeholders[activeTab].subtitle,
          manifest: activeTab === 'soon' ? t.feed.tabs.placeholders.soon.manifest : undefined,
        };

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={placeholderScrollRef}
          style={styles.screen}
          contentContainerStyle={isBusinessHub ? undefined : styles.placeholderContent}
          onScroll={handlePlaceholderScroll}
          scrollEventThrottle={16}
        >
          <FeedHeader
            activeTab={activeTab}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onTabPress={handleTabPress}
          />
          {isBusinessHub ? (
            <BusinessHub />
          ) : placeholder ? (
            <FeedTabPlaceholder {...placeholder} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <YStack flex={1}>
        <FlashList<PostCardPost>
          ref={socialListRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={keyExtractor}
          ListHeaderComponent={socialHeader}
          ListEmptyComponent={
            feedQuery.isLoading ? (
              <YStack>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </YStack>
            ) : (
              <FeedEmptyState />
            )
          }
          ListFooterComponent={<FeedFooter isFetchingNextPage={feedQuery.isFetchingNextPage} />}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
              void feedQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.8}
          onRefresh={() => void feedQuery.refetch()}
          refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
          onScroll={handleSocialScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />

        {/* FAB — Créer un post (E4-03 : l'écran existait sans point d'entrée) */}
        <TouchableOpacity
          onPress={() => router.push('/post/create')}
          activeOpacity={0.85}
          style={styles.composeFab}
          accessibilityRole="button"
          accessibilityLabel={t.feed.screen.createPostA11y}
        >
          <SquarePen size={24} color="#000000" strokeWidth={2.4} />
        </TouchableOpacity>

        {selectedPost ? (
          <PostMenuSheet
            postId={selectedPost.id}
            isAuthor={selectedPost.author_id === currentUserId}
            open={isPostMenuOpen}
            onOpenChange={setIsPostMenuOpen}
            onShare={() => void handleMenuShare()}
            onDelete={handleDeleteSelectedPost}
            onHidden={handleHiddenSelectedPost}
            onHideError={() => showToast({ message: t.feed.screen.toastHideFailed })}
            onCopyLink={() => showToast({ message: t.feed.screen.toastLinkCopied })}
          />
        ) : null}

        {toast ? (
          <XStack
            position="absolute"
            bottom={24}
            alignSelf="center"
            backgroundColor="$surfaceElevated"
            borderWidth={1}
            borderColor="$accentNeon"
            borderRadius="$4"
            paddingHorizontal="$4"
            paddingVertical="$2"
            alignItems="center"
            gap="$4"
          >
            <Text color="$color" fontSize={13} fontWeight="700">
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <Text
                color="$accentNeon"
                fontSize={13}
                fontWeight="700"
                onPress={toast.onAction}
                pressStyle={{ opacity: 0.72 }}
              >
                {toast.actionLabel}
              </Text>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  composeFab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10D970',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerSideButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
  logo: {
    width: 126,
    height: 30,
  },
  placeholderContent: {
    backgroundColor: '#000000',
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  tabsContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
});
