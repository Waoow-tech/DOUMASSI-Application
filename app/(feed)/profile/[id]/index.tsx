// Écran "Profil d'un autre utilisateur" — E3-03.
// Route : app/(feed)/profile/[id]/index.tsx
// Vérifie le blocage au mount, gère 404, profil privé, follow/unfollow,
// kebab menu (share, block, report). Réutilise les composants partagés.

import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeft,
  Flag,
  Lock,
  MessageCircle,
  Share2,
  ShieldBan,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { BlockConfirmModal } from '@/features/profile/components/BlockConfirmModal';
import { FollowButton } from '@/features/profile/components/FollowButton';
import { ProfileEmptyState } from '@/features/profile/components/ProfileEmptyState';
import { ProfileGridItem } from '@/features/profile/components/ProfileGridItem';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileSkeleton } from '@/features/profile/components/ProfileSkeleton';
import { ProfileStats } from '@/features/profile/components/ProfileStats';
import { ProfileTabs, type ProfileTab } from '@/features/profile/components/ProfileTabs';
import { UnfollowConfirmModal } from '@/features/profile/components/UnfollowConfirmModal';
import { useFollow } from '@/features/profile/hooks/useFollow';
import { useUserProfile, type PostGridItem } from '@/features/profile/hooks/useProfile';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const GRID_GAP = 2;
const NUM_COLUMNS = 3;

export default function OtherUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetUserId = id ?? null;

  const { profile, counters, posts, isLoading, isError } = useUserProfile(targetUserId);
  const { status: followStatus, isPending, follow, unfollow } = useFollow(targetUserId);

  const { width: screenWidth } = useWindowDimensions();
  const itemSize = (screenWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUnfollowModalOpen, setIsUnfollowModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockChecked, setBlockChecked] = useState(false);

  // --- Vérification de blocage au mount ---
  useEffect(() => {
    if (!targetUserId) return;

    let cancelled = false;

    async function checkBlock() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const currentUserId = session.session?.user?.id;
        if (!currentUserId) return;

        // Vérifie dans les deux sens : j'ai bloqué cet user OU il m'a bloqué
        const { data, error } = await supabase
          .from('blocks')
          .select('id')
          .or(
            `and(blocker_id.eq.${currentUserId},blocked_id.eq.${targetUserId}),` +
              `and(blocker_id.eq.${targetUserId},blocked_id.eq.${currentUserId})`
          )
          .limit(1);

        if (cancelled) return;

        if (error) {
          logger.warn('Erreur check block', { message: error.message });
          setBlockChecked(true);
          return;
        }

        if (data && data.length > 0) {
          // Blocage détecté — redirige vers le feed
          Alert.alert('', 'User not available');
          router.replace('/feed');
          return;
        }

        setBlockChecked(true);
      } catch (err) {
        logger.warn('Block check failed', { message: (err as Error).message });
        if (!cancelled) setBlockChecked(true);
      }
    }

    void checkBlock();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  // --- Handlers ---
  const handleKebabPress = useCallback(() => setIsMenuOpen(true), []);

  const handleFollow = useCallback(async () => {
    try {
      await follow();
    } catch (err) {
      logger.warn('Follow error', { message: (err as Error).message });
    }
  }, [follow]);

  const handleUnfollow = useCallback(async () => {
    try {
      await unfollow();
    } catch (err) {
      logger.warn('Unfollow error', { message: (err as Error).message });
    }
  }, [unfollow]);

  const handleUnfollowRequest = useCallback(() => {
    setIsUnfollowModalOpen(true);
  }, []);

  const handleCancelRequest = useCallback(async () => {
    try {
      await unfollow();
    } catch (err) {
      logger.warn('Cancel follow request error', { message: (err as Error).message });
    }
  }, [unfollow]);

  const handleMessage = useCallback(() => {
    if (targetUserId) {
      router.push(`/messages/${targetUserId}`);
    }
  }, [targetUserId]);

  const handleShareProfile = useCallback(async () => {
    setIsMenuOpen(false);
    try {
      const username = profile?.username ?? '';
      await Share.share({
        message: `Check out @${username} on DOUMASSI! 🚀`,
      });
    } catch {
      // Annulé
    }
  }, [profile?.username]);

  const handleBlockUser = useCallback(() => {
    setIsMenuOpen(false);
    setIsBlockModalOpen(true);
  }, []);

  const handleBlockConfirm = useCallback(async () => {
    if (!targetUserId) return;
    setIsBlocking(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session.session?.user?.id;
      if (!currentUserId) return;

      const { error } = await supabase
        .from('blocks')
        .insert({ blocker_id: currentUserId, blocked_id: targetUserId });

      if (error) throw error;

      router.replace('/feed');
    } catch (err) {
      logger.warn('Block failed', { message: (err as Error).message });
      Alert.alert('Error', 'Could not block this user. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  }, [targetUserId]);

  const handleReport = useCallback(() => {
    setIsMenuOpen(false);
    // TODO: Implémenter le report (Sprint futur)
    Alert.alert('Report', 'Report feature coming soon.');
  }, []);

  const handleFollowers = useCallback(() => {
    if (targetUserId) router.push(`/profile/${targetUserId}/followers`);
  }, [targetUserId]);

  const handleFollowing = useCallback(() => {
    if (targetUserId) router.push(`/profile/${targetUserId}/following`);
  }, [targetUserId]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/feed');
    }
  }, []);

  const renderGridItem = useCallback(
    ({ item, index }: { item: PostGridItem; index: number }) => (
      <ProfileGridItem
        item={item}
        size={itemSize}
        isLastColumn={(index + 1) % NUM_COLUMNS === 0}
        gap={GRID_GAP}
      />
    ),
    [itemSize]
  );

  const keyExtractor = useCallback((item: PostGridItem) => item.id, []);

  // --- Attente du check de blocage ---
  if (!blockChecked || isLoading) {
    return <ProfileSkeleton />;
  }

  // --- Self-visit : redirige vers son propre profil ---
  if (followStatus === 'self') {
    router.replace('/profile');
    return <ProfileSkeleton />;
  }

  // --- État 404 ---
  if (isError || !profile) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        gap="$4"
        paddingHorizontal="$5"
      >
        <AlertTriangle size={48} color="#A0A0A0" />
        <Text fontSize={18} fontWeight="600" color="$color" textAlign="center">
          User not found
        </Text>
        <Text fontSize={14} color="$textSecondary" textAlign="center">
          This account may have been deleted or doesn&apos;t exist.
        </Text>
        <Button
          height={44}
          paddingHorizontal="$5"
          backgroundColor="$accentNeon"
          borderRadius="$lg"
          color="#000000"
          fontWeight="700"
          fontSize={14}
          onPress={handleGoBack}
          pressStyle={{ opacity: 0.85 }}
          icon={<ChevronLeft size={18} color="#000000" />}
        >
          Go back
        </Button>
      </YStack>
    );
  }

  // --- Profil privé + non suivi (self already redirected above) ---
  const isPrivateAndNotFollowing = profile.is_private === true && followStatus !== 'following';

  const gridData = activeTab === 'grid' ? posts : [];

  const ListHeader = (
    <YStack>
      <ProfileHeader profile={profile} onKebabPress={handleKebabPress} />

      <ProfileStats
        posts={counters.posts}
        followers={counters.followers}
        following={counters.following}
        onFollowersPress={handleFollowers}
        onFollowingPress={handleFollowing}
      />

      {/* Boutons Follow + Message */}
      <XStack marginTop="$4" paddingHorizontal="$5" gap="$3">
        <FollowButton
          status={followStatus}
          isPending={isPending}
          onFollow={() => void handleFollow()}
          onUnfollowRequest={handleUnfollowRequest}
          onCancelRequest={() => void handleCancelRequest()}
        />
        <Button
          flex={1}
          height={40}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$borderColorHover"
          borderRadius="$lg"
          color="$color"
          fontWeight="600"
          fontSize={14}
          onPress={handleMessage}
          pressStyle={{ opacity: 0.7, scale: 0.98 }}
          icon={<MessageCircle size={16} color="#FFFFFF" />}
        >
          Message
        </Button>
      </XStack>

      {/* Profil privé : lock + message */}
      {isPrivateAndNotFollowing ? (
        <YStack alignItems="center" justifyContent="center" paddingVertical={60} gap="$3">
          <YStack
            width={64}
            height={64}
            borderRadius={32}
            borderWidth={2}
            borderColor="$borderColorHover"
            alignItems="center"
            justifyContent="center"
          >
            <Lock size={28} color="#A0A0A0" />
          </YStack>
          <Text
            fontSize={15}
            color="$textSecondary"
            textAlign="center"
            fontWeight="500"
            paddingHorizontal="$5"
            lineHeight={22}
          >
            This account is private.{'\n'}Follow @{profile.username} to see their posts.
          </Text>
        </YStack>
      ) : (
        <ProfileTabs active={activeTab} onChange={setActiveTab} />
      )}
    </YStack>
  );

  return (
    <>
      {isPrivateAndNotFollowing ? (
        // Pas de grille pour les profils privés non suivis — juste le header
        <FlashList<PostGridItem>
          data={[]}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlashList<PostGridItem>
          data={gridData}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ProfileEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Menu kebab — Share / Block / Report */}
      <Sheet
        modal
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        snapPoints={[30]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(0,0,0,0.5)"
        />
        <Sheet.Frame
          backgroundColor="$surface"
          borderTopLeftRadius={16}
          borderTopRightRadius={16}
          paddingHorizontal="$4"
          paddingTop="$3"
          paddingBottom="$5"
        >
          <XStack justifyContent="center" marginBottom="$3">
            <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColorHover" />
          </XStack>

          <YStack gap="$1">
            <Button
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={() => void handleShareProfile()}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Share2 size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                Share profile
              </Text>
            </Button>

            <Button
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleBlockUser}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<ShieldBan size={20} color="#FF3B30" />}
            >
              <Text color="$danger" fontSize={15} fontWeight="500">
                Block @{profile.username}
              </Text>
            </Button>

            <Button
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleReport}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Flag size={20} color="#A0A0A0" />}
            >
              <Text color="$textSecondary" fontSize={15} fontWeight="500">
                Report
              </Text>
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>

      {/* Modale Unfollow */}
      <UnfollowConfirmModal
        open={isUnfollowModalOpen}
        onOpenChange={setIsUnfollowModalOpen}
        username={profile.username}
        onConfirm={() => void handleUnfollow()}
      />

      {/* Modale Block */}
      <BlockConfirmModal
        open={isBlockModalOpen}
        onOpenChange={setIsBlockModalOpen}
        username={profile.username}
        onConfirm={() => void handleBlockConfirm()}
        isPending={isBlocking}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
});
