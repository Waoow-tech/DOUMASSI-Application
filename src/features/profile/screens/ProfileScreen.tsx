// Écran "Mon profil" — E3-01 (v2).
// Composition de composants partagés (ProfileHeader, ProfileStats, ProfileTabs,
// ProfileGridItem) + boutons d'action "Modifier" / "Partager" + kebab menu
// avec Settings / Share. Fidèle à la maquette Canva, dark mode exclusif.

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Settings, Share2, Store } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { ProductCard } from '@/features/profile/components/ProductCard';
import { ProfileEmptyState } from '@/features/profile/components/ProfileEmptyState';
import { ProfileGridItem } from '@/features/profile/components/ProfileGridItem';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileSkeleton } from '@/features/profile/components/ProfileSkeleton';
import { ProfileStats } from '@/features/profile/components/ProfileStats';
import { ProfileTabs, type ProfileTab } from '@/features/profile/components/ProfileTabs';
import { useProducts, type ProductItem } from '@/features/profile/hooks/useProducts';
import { useProfile, type PostGridItem } from '@/features/profile/hooks/useProfile';
import { t } from '@/i18n';

const GRID_GAP = 2;
const NUM_COLUMNS = 3;

export function ProfileScreen() {
  const { profile, userId, counters, posts, isLoading, refetch } = useProfile();
  const { data: products = [] } = useProducts(userId);
  const { width: screenWidth } = useWindowDimensions();
  const copy = t.profile;

  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const numColumns = activeTab === 'shop' ? 2 : NUM_COLUMNS;
  const itemSize = (screenWidth - GRID_GAP * (numColumns - 1)) / numColumns;

  const handleEdit = useCallback(() => {
    router.push('/profile/edit');
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: copy.shareMessage });
    } catch {
      // L'utilisateur a annulé le partage.
    }
  }, [copy.shareMessage]);

  const handleKebabPress = useCallback(() => setIsMenuOpen(true), []);

  const handleMenuSettings = useCallback(() => {
    setIsMenuOpen(false);
    router.push('/settings');
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

  const renderItem = useCallback(
    ({ item, index }: { item: PostGridItem | ProductItem; index: number }) => {
      if (activeTab === 'shop') {
        return (
          <ProductCard
            product={item as ProductItem}
            size={itemSize}
            isLastColumn={(index + 1) % numColumns === 0}
            gap={GRID_GAP}
          />
        );
      }
      return (
        <ProfileGridItem
          item={item as PostGridItem}
          size={itemSize}
          isLastColumn={(index + 1) % numColumns === 0}
          gap={GRID_GAP}
        />
      );
    },
    [activeTab, itemSize, numColumns]
  );

  const keyExtractor = useCallback((item: PostGridItem | ProductItem) => item.id, []);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // Sélection des données selon l'onglet
  const listData = activeTab === 'grid' ? posts : activeTab === 'shop' ? products : [];

  const ShopEmptyState = () => (
    <YStack alignItems="center" justifyContent="center" paddingVertical={80} gap="$3">
      <YStack
        width={72}
        height={72}
        borderRadius={36}
        borderWidth={2}
        borderColor="$borderColorHover"
        alignItems="center"
        justifyContent="center"
      >
        <Store size={32} color="#A0A0A0" />
      </YStack>
      <Text fontSize={15} color="$textSecondary" textAlign="center" fontWeight="500">
        Aucun produit pour l&apos;instant
      </Text>
    </YStack>
  );

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
      <FlashList
        key={`${activeTab}-${numColumns}`} // Force le re-render quand on change d'onglet/colonnes
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={activeTab === 'shop' ? ShopEmptyState : ProfileEmptyState}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={false}
        contentContainerStyle={styles.listContent}
      />

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
