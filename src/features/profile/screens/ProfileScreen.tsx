// Écran "Mon profil" — E3-01 (v2) + E3-VENDOR.
// Composition de composants partagés (ProfileHeader, ProfileStats, ProfileTabs,
// ProfileGridItem) + boutons d'action "Modifier" / "Partager" + kebab menu
// avec Settings / Share. 4 onglets : Grille / Reels / Identifié / Boutique.
// Fidèle à la maquette Canva, dark mode exclusif.

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Bookmark, Settings, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { ListingCard } from '@/features/profile/components/ListingCard';
import { ProfileEmptyState } from '@/features/profile/components/ProfileEmptyState';
import { ProfileGridItem } from '@/features/profile/components/ProfileGridItem';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileSkeleton } from '@/features/profile/components/ProfileSkeleton';
import { ProfileStats } from '@/features/profile/components/ProfileStats';
import { ProfileTabs, type ProfileTab } from '@/features/profile/components/ProfileTabs';
import { ShopEmptyState } from '@/features/profile/components/ShopEmptyState';
import { useListings, type ListingItem } from '@/features/profile/hooks/useListings';
import { useProfile, type PostGridItem } from '@/features/profile/hooks/useProfile';
import { t } from '@/i18n';

const GRID_GAP = 2;
const NUM_COLUMNS = 3;

export function ProfileScreen() {
  const { profile, userId, counters, posts, isLoading, refetch } = useProfile();
  const { data: listings } = useListings(userId);
  const { width: screenWidth } = useWindowDimensions();
  const copy = t.profile;

  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const itemSize = (screenWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const handleEdit = useCallback(() => {
    router.push('/profile/edit');
  }, []);

  const handleShare = useCallback(async () => {
    const username = profile?.username;
    if (!username) return;
    try {
      // URL incluse dans `message` car Android ignore la prop `url` de
      // Share.share et ne lit que `message` (cf bug remonté 2026-06-24).
      await Share.share({
        message: `${copy.shareMessage}\nhttps://doumassi.app/u/${username}`,
      });
    } catch {
      // L'utilisateur a annulé le partage.
    }
  }, [copy.shareMessage, profile?.username]);

  const handleKebabPress = useCallback(() => setIsMenuOpen(true), []);

  const handleMenuSettings = useCallback(() => {
    setIsMenuOpen(false);
    router.push('/settings');
  }, []);

  // E4-07 : raccourci kebab → /bookmarks (visible uniquement sur mon profil,
  // ProfileScreen étant le rendu du profil personnel).
  const handleMenuBookmarks = useCallback(() => {
    setIsMenuOpen(false);
    router.push('/bookmarks');
  }, []);

  const handleMenuShare = useCallback(() => {
    setIsMenuOpen(false);
    void handleShare();
  }, [handleShare]);

  const handleFollowers = useCallback(() => {
    if (userId) router.push(`/profile/${userId}/followers`);
  }, [userId]);

  const handleFollowing = useCallback(() => {
    if (userId) router.push(`/profile/${userId}/following`);
  }, [userId]);

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

  const renderListingItem = useCallback(
    ({ item, index }: { item: ListingItem; index: number }) => (
      <ListingCard
        item={item}
        size={itemSize}
        gap={GRID_GAP}
        isLastColumn={(index + 1) % NUM_COLUMNS === 0}
      />
    ),
    [itemSize]
  );

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const isShopTab = activeTab === 'shop';
  // Seuls les onglets "grid" et "shop" affichent du contenu pour l'instant.
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

      <XStack marginTop="$4" paddingHorizontal="$5" gap="$3">
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
          onPress={handleEdit}
          pressStyle={{ opacity: 0.7, scale: 0.98 }}
        >
          {copy.editButton}
        </Button>
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
          onPress={() => void handleShare()}
          pressStyle={{ opacity: 0.7, scale: 0.98 }}
        >
          {copy.shareButton}
        </Button>
      </XStack>

      <ProfileTabs active={activeTab} onChange={setActiveTab} />
    </YStack>
  );

  return (
    <>
      {isShopTab ? (
        <FlashList<ListingItem>
          data={listings ?? []}
          renderItem={renderListingItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ShopEmptyState}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
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
          onRefresh={refetch}
          refreshing={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Sheet
        modal
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        snapPoints={[25]}
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
              onPress={handleMenuSettings}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Settings size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                {copy.kebabMenu.settings}
              </Text>
            </Button>

            <Button
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleMenuBookmarks}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Bookmark size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                Sauvegardés
              </Text>
            </Button>

            <Button
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleMenuShare}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Share2 size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                {copy.kebabMenu.shareProfile}
              </Text>
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
});
