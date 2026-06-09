import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Rocket, Search, Settings, Sparkles, Store, User, Wallet } from 'lucide-react-native';
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
import { FeedStories } from '@/features/feed/components/FeedStories';
import { FeedTabPlaceholder } from '@/features/feed/components/FeedTabPlaceholder';
import { useDeletePost } from '@/features/feed/hooks/useDeletePost';
import { useFeed, useToggleFeedBookmark, useToggleFeedLike } from '@/features/feed/hooks/useFeed';
import { type FeedStory, useFeedStories } from '@/features/feed/hooks/useFeedStories';
import { useUnhidePost } from '@/features/feed/hooks/useHiddenPosts';
import { SearchBar } from '@/features/profile/components/SearchBar';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../../../assets/Logo-Doumassi.webp') as number;

type FeedTabId = 'social' | 'business' | 'ai' | 'wallet' | 'soon';

type FeedTab = {
  id: FeedTabId;
  label: string;
};

type FeedToast = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const FEED_TABS: FeedTab[] = [
  { id: 'social', label: 'Social' },
  { id: 'business', label: 'Business' },
  { id: 'ai', label: 'AI' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'soon', label: 'Soon' },
];

const PLACEHOLDERS = {
  business: {
    Icon: Store,
    title: 'Marketplace bientôt disponible',
    subtitle: 'Achetez, vendez, découvrez.',
  },
  ai: {
    Icon: Sparkles,
    title: 'Studio AI bientôt disponible',
    subtitle: "Assistant IA, génération d'images et plus.",
  },
  wallet: {
    Icon: Wallet,
    title: 'Dpay bientôt disponible',
    subtitle: 'Votre wallet crypto intégré.',
  },
  soon: {
    Icon: Rocket,
    title: 'Encore plus à venir',
    subtitle: 'DOUMASSI évolue. Restez connecté.',
    manifest:
      'Un espace social, business, créatif et financier pensé pour rassembler vos usages dans un seul univers.',
  },
} satisfies Record<Exclude<FeedTabId, 'social'>, React.ComponentProps<typeof FeedTabPlaceholder>>;

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
  return (
    <YStack backgroundColor="$background" paddingTop="$3" paddingBottom="$2">
      <XStack alignItems="center" justifyContent="center" paddingHorizontal="$4" height={42}>
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          activeOpacity={0.65}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={styles.headerSideButton}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon profil"
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
          accessibilityLabel="Ouvrir les paramètres"
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
          const isActive = activeTab === tab.id;
          return (
            <YStack
              key={tab.id}
              height={36}
              paddingHorizontal={14}
              borderRadius={18}
              backgroundColor={isActive ? '#FFFFFF' : '$surface'}
              alignItems="center"
              justifyContent="center"
              onPress={() => onTabPress(tab.id)}
              pressStyle={{ scale: 0.97 }}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir l'onglet ${tab.label}`}
            >
              <Text
                color={isActive ? '#000000' : '$textSecondary'}
                fontSize={14}
                fontWeight={isActive ? '700' : '500'}
              >
                {tab.label}
              </Text>
            </YStack>
          );
        })}
      </ScrollView>

      <SearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        placeholder={activeTab === 'social' ? 'Rechercher des posts...' : 'Rechercher...'}
      />
    </YStack>
  );
}

function FeedEmptyState() {
  return (
    <YStack alignItems="center" justifyContent="center" padding="$6" gap="$3">
      <Search size={34} color="#A0A0A0" />
      <Text color="$color" fontSize={17} fontWeight="700" textAlign="center">
        Suivez des comptes pour voir leurs posts ici
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
        Découvrir des comptes
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
      showToast({ message: 'Partage impossible, réessayez' });
    }
  }, [selectedPost, showToast]);

  const handleDeleteSelectedPost = useCallback(async () => {
    if (!selectedPost) return;

    try {
      await deletePostMutation.mutateAsync(selectedPost.id);
      showToast({ message: 'Post supprimé' });
    } catch {
      showToast({ message: 'Suppression impossible, réessayez' });
      throw new Error('Delete post failed');
    }
  }, [deletePostMutation, selectedPost, showToast]);

  const handleHiddenSelectedPost = useCallback(() => {
    if (!selectedPost) return;
    const hiddenPostId = selectedPost.id;

    showToast(
      {
        message: 'Post masqué',
        actionLabel: 'Annuler',
        onAction: () => {
          unhidePostMutation.mutate(hiddenPostId, {
            onSuccess: () => showToast({ message: 'Affichage restauré' }),
          });
        },
      },
      5000
    );
  }, [selectedPost, showToast, unhidePostMutation]);

  const renderPost = useCallback(
    ({ item }: { item: PostCardPost }) => (
      <PostCard
        post={item}
        onLike={() => likeMutation.mutate(item.id)}
        onBookmark={() => bookmarkMutation.mutate(item.id)}
        onOpenDetail={() => router.push(`/post/${item.id}`)}
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
    const placeholder = PLACEHOLDERS[activeTab];

    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={placeholderScrollRef}
          style={styles.screen}
          contentContainerStyle={styles.placeholderContent}
          onScroll={handlePlaceholderScroll}
          scrollEventThrottle={16}
        >
          <FeedHeader
            activeTab={activeTab}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onTabPress={handleTabPress}
          />
          <FeedTabPlaceholder {...placeholder} />
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

        {selectedPost ? (
          <PostMenuSheet
            postId={selectedPost.id}
            isAuthor={selectedPost.author_id === currentUserId}
            open={isPostMenuOpen}
            onOpenChange={setIsPostMenuOpen}
            onShare={() => void handleMenuShare()}
            onDelete={handleDeleteSelectedPost}
            onHidden={handleHiddenSelectedPost}
            onHideError={() => showToast({ message: 'Masquage impossible, réessayez' })}
            onCopyLink={() => showToast({ message: 'Lien copié' })}
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
