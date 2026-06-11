// Écran Followers / Following — E3-05.
// Composant partagé par les 4 routes :
//   /profile/followers, /profile/following,
//   /profile/[id]/followers, /profile/[id]/following.
//
// FlashList virtualisée, pagination infinie (20/page),
// filtre client-side debouncé (200ms), boutons contextuels
// via useFollow (E3-04), modale Unfollow.

import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { supabase } from '@/lib/supabase';

import { SearchBar } from '../components/SearchBar';
import { UnfollowConfirmModal } from '../components/UnfollowConfirmModal';
import { UserRow, type UserRowData } from '../components/UserRow';
import { useFollow } from '../hooks/useFollow';

type TabType = 'followers' | 'following';

interface FollowRelationScreenProps {
  userId: string;
  initialTab?: TabType;
}

const PAGE_SIZE = 20;

// Logo Doumassi — affiché uniquement sur cet écran
const logoSource = require('../../../../assets/Logo-Doumassi.webp') as number;

// ─── Action Button (extracted for hook rules) ────────────────────────

interface ActionButtonProps {
  user: UserRowData;
  currentUserId: string | null;
  targetUserId: string;
  activeTab: TabType;
  onUnfollowRequest: (user: UserRowData, onConfirm: () => void) => void;
}

function ActionButton({
  user,
  currentUserId,
  targetUserId,
  activeTab,
  onUnfollowRequest,
}: ActionButtonProps) {
  const { status, isPending, follow, unfollow } = useFollow(user.id);

  // Ne rien afficher pour soi-même
  if (user.id === currentUserId) return null;

  const isMyList = currentUserId === targetUserId;

  // ── Mes followers → Follow back / Following ──
  // « Follow back » si je ne suis pas encore cet abonné,
  // « Following » si je le suis déjà (avec modale Unfollow).
  if (isMyList && activeTab === 'followers') {
    if (status === 'following') {
      return (
        <Button
          height={32}
          paddingHorizontal="$3"
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$md"
          onPress={() => onUnfollowRequest(user, () => void unfollow())}
          disabled={isPending}
          pressStyle={{ opacity: 0.7 }}
        >
          {isPending ? (
            <Spinner size="small" color="#FFFFFF" />
          ) : (
            <Button.Text color="$color" fontSize={13} fontWeight="600">
              Following
            </Button.Text>
          )}
        </Button>
      );
    }

    // idle → "Follow back" (filled blanc / texte noir)
    return (
      <Button
        height={32}
        paddingHorizontal="$3"
        backgroundColor="#FFFFFF"
        borderRadius="$md"
        onPress={() => void follow()}
        disabled={isPending}
        pressStyle={{ opacity: 0.7 }}
      >
        {isPending ? (
          <Spinner size="small" color="#000000" />
        ) : (
          <Button.Text color="#000000" fontSize={13} fontWeight="700">
            Follow back
          </Button.Text>
        )}
      </Button>
    );
  }

  // ── Mes following → bouton "Following" avec modale Unfollow ──
  if (isMyList && activeTab === 'following') {
    return (
      <Button
        height={32}
        paddingHorizontal="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$md"
        onPress={() => onUnfollowRequest(user, () => void unfollow())}
        disabled={isPending}
        pressStyle={{ opacity: 0.7 }}
      >
        {isPending ? (
          <Spinner size="small" color="#FFFFFF" />
        ) : (
          <Button.Text color="$color" fontSize={13} fontWeight="600">
            Following
          </Button.Text>
        )}
      </Button>
    );
  }

  // ── Profil d'un autre → Follow / Following / Pending ──
  if (status === 'following') {
    return (
      <Button
        height={32}
        paddingHorizontal="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$md"
        onPress={() => onUnfollowRequest(user, () => void unfollow())}
        disabled={isPending}
        pressStyle={{ opacity: 0.7 }}
      >
        {isPending ? (
          <Spinner size="small" color="#FFFFFF" />
        ) : (
          <Button.Text color="$color" fontSize={13} fontWeight="600">
            Following
          </Button.Text>
        )}
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button
        height={32}
        paddingHorizontal="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$md"
        onPress={() => void unfollow()}
        disabled={isPending}
        pressStyle={{ opacity: 0.7 }}
      >
        {isPending ? (
          <Spinner size="small" color="#FFFFFF" />
        ) : (
          <Button.Text color="$color" fontSize={13} fontWeight="600">
            Requested
          </Button.Text>
        )}
      </Button>
    );
  }

  // idle → Follow (filled white / text black per design spec)
  return (
    <Button
      height={32}
      paddingHorizontal="$4"
      backgroundColor="#FFFFFF"
      borderRadius="$md"
      onPress={() => void follow()}
      disabled={isPending}
      pressStyle={{ opacity: 0.7 }}
    >
      {isPending ? (
        <Spinner size="small" color="#000000" />
      ) : (
        <Button.Text color="#000000" fontSize={13} fontWeight="700">
          Follow
        </Button.Text>
      )}
    </Button>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────

export function FollowRelationScreen({
  userId,
  initialTab = 'followers',
}: FollowRelationScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modale Unfollow
  const [unfollowTarget, setUnfollowTarget] = useState<{
    user: UserRowData;
    onConfirm: () => void;
  } | null>(null);

  // Debounce search (200ms per ticket)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Resolve current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const isMyList = currentUserId === userId;

  // ── Data fetching ──────────────────────────────────────────────────

  const fetchFollows = useCallback(
    async ({ pageParam = 0 }) => {
      if (!currentUserId) return { data: [], nextCursor: null };

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query;

      if (activeTab === 'followers') {
        query = supabase
          .from('follows')
          .select(
            `
            follower_id,
            profile:profiles!follower_id(id, username, full_name, avatar_url, is_verified)
          `
          )
          .eq('followed_id', userId)
          .eq('status', 'accepted');
      } else {
        query = supabase
          .from('follows')
          .select(
            `
            followed_id,
            profile:profiles!followed_id(id, username, full_name, avatar_url, is_verified)
          `
          )
          .eq('follower_id', userId)
          .eq('status', 'accepted');
      }

      // Cast nécessaire : Supabase TS ne type pas les joins FK
      // nommés (profiles!follower_id). Le SDK retourne un
      // PostgrestFilterBuilder générique dont `.range()` n'est
      // pas exposé sans cast.
      // Voir : github.com/supabase/postgrest-js/issues/551
      type PaginatedQuery = {
        range: (
          from: number,
          to: number
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean }
          ) => Promise<{
            data: unknown[];
            error: unknown;
          }>;
        };
      };

      const { data, error } = await (query as unknown as PaginatedQuery)
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Shape brute retournée par le join FK nommé
      interface FollowRow {
        profile: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          is_verified: boolean;
        };
      }

      const rows = (data ?? []) as FollowRow[];
      const mappedData: UserRowData[] = rows.map((item) => ({
        id: item.profile.id,
        username: item.profile.username,
        full_name: item.profile.full_name ?? null,
        avatar_url: item.profile.avatar_url ?? null,
        is_verified: Boolean(item.profile.is_verified),
      }));

      return {
        data: mappedData,
        nextCursor: mappedData.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    [activeTab, userId, currentUserId]
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ['follow-relation-list', userId, activeTab, currentUserId],
      queryFn: fetchFollows,
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!currentUserId,
    });

  // ── Client-side filtering ──────────────────────────────────────────

  const allItems = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) || [];
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(
      (item) =>
        item.username.toLowerCase().includes(q) || (item.full_name?.toLowerCase() || '').includes(q)
    );
  }, [allItems, debouncedSearch]);

  // ── Render helpers ─────────────────────────────────────────────────

  const handleUnfollowRequest = useCallback((user: UserRowData, onConfirm: () => void) => {
    setUnfollowTarget({ user, onConfirm });
  }, []);

  // Menu meatballs — placeholder pour actions futures
  // (Remove, Block, Report, etc.)
  const handleMenuPress = useCallback((_user: UserRowData) => {
    // TODO: ouvrir un action sheet avec les options
    // contextuelles (Remove follower, Block, Report…)
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: UserRowData }) => (
      <UserRow
        user={item}
        onPress={() => router.push(`/profile/${item.id}`)}
        onMenuPress={() => handleMenuPress(item)}
        rightSlot={
          <ActionButton
            user={item}
            currentUserId={currentUserId}
            targetUserId={userId}
            activeTab={activeTab}
            onUnfollowRequest={handleUnfollowRequest}
          />
        }
      />
    ),
    [activeTab, currentUserId, userId, handleUnfollowRequest, handleMenuPress]
  );

  // ── Header ─────────────────────────────────────────────────────────

  const ListHeader = () => (
    <YStack backgroundColor="$background" paddingTop={insets.top}>
      {/* Flèche retour à gauche + logo centré */}
      <XStack height={50} paddingHorizontal="$4" alignItems="center">
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <XStack flex={1} justifyContent="center">
          <Image source={logoSource} style={{ width: 28, height: 28 }} contentFit="contain" />
        </XStack>
        {/* Espace symétrique pour centrer le logo */}
        <View width={24} />
      </XStack>

      {/* Tabs */}
      <XStack borderBottomWidth={StyleSheet.hairlineWidth} borderBottomColor="$borderColor">
        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('followers')}>
          <YStack alignItems="center" gap="$2" paddingBottom="$3">
            <Text
              fontSize={15}
              fontWeight={activeTab === 'followers' ? '700' : '400'}
              color={activeTab === 'followers' ? '$color' : '$textSecondary'}
            >
              Followers
            </Text>
            {activeTab === 'followers' && (
              <View height={2} width="100%" backgroundColor="#FFFFFF" />
            )}
          </YStack>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('following')}>
          <YStack alignItems="center" gap="$2" paddingBottom="$3">
            <Text
              fontSize={15}
              fontWeight={activeTab === 'following' ? '700' : '400'}
              color={activeTab === 'following' ? '$color' : '$textSecondary'}
            >
              Following
            </Text>
            {activeTab === 'following' && (
              <View height={2} width="100%" backgroundColor="#FFFFFF" />
            )}
          </YStack>
        </TouchableOpacity>
      </XStack>

      {/* Search Bar */}
      <YStack paddingVertical="$3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={activeTab === 'followers' ? 'Search followers...' : 'Search following...'}
        />
      </YStack>
    </YStack>
  );

  // ── Empty state (contextual per ticket) ────────────────────────────

  const EmptyState = () => {
    if (isLoading) {
      return (
        <YStack paddingVertical={100} alignItems="center">
          <Spinner size="large" color="#FFFFFF" />
        </YStack>
      );
    }

    let title: string;
    let subtitle: string | null = null;

    if (activeTab === 'followers') {
      title = 'No followers yet';
      if (isMyList) subtitle = 'Share your profile to get started';
    } else {
      title = 'Not following anyone yet';
      if (isMyList) subtitle = 'Discover people to follow';
    }

    return (
      <YStack paddingVertical={100} alignItems="center" gap="$3">
        <Users size={48} color="#A0A0A0" />
        <Text color="$textSecondary" fontSize={16} fontWeight="500">
          {title}
        </Text>
        {subtitle ? (
          <Text color="$placeholderColor" fontSize={14}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
    );
  };

  // ── Main render ────────────────────────────────────────────────────

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlashList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.8}
        ListFooterComponent={() => (
          <YStack padding="$4" alignItems="center" marginBottom={40}>
            {isFetchingNextPage && <Spinner size="small" color="#FFFFFF" />}
          </YStack>
        )}
        ListEmptyComponent={EmptyState}
        onRefresh={() => void refetch()}
        refreshing={false}
      />

      {/* Modale Unfollow */}
      {unfollowTarget && (
        <UnfollowConfirmModal
          open={!!unfollowTarget}
          onOpenChange={(open) => !open && setUnfollowTarget(null)}
          username={unfollowTarget.user.username}
          onConfirm={() => {
            unfollowTarget.onConfirm();
            setUnfollowTarget(null);
          }}
        />
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
});
