import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Button, XStack, YStack } from 'tamagui';

import { ProfileEmptyState } from '@/features/profile/components/ProfileEmptyState';
import { ProfileGridItem } from '@/features/profile/components/ProfileGridItem';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileSkeleton } from '@/features/profile/components/ProfileSkeleton';
import { ProfileStats } from '@/features/profile/components/ProfileStats';
import { ProfileTabs, type ProfileTab } from '@/features/profile/components/ProfileTabs';
import { type PostGridItem, useUserProfile } from '@/features/profile/hooks/useProfile';

const GRID_GAP = 2;
const NUM_COLUMNS = 3;

export default function PublicProfileRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = typeof params.id === 'string' ? params.id : null;
  const { profile, counters, posts, isLoading, refetch } = useUserProfile(userId);
  const { width: screenWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');

  const itemSize = (screenWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const gridData = activeTab === 'grid' ? posts : [];

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

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const ListHeader = (
    <YStack>
      <ProfileHeader profile={profile} onKebabPress={() => router.back()} />

      <XStack position="absolute" top="$12" left="$4" zIndex={20}>
        <Button
          circular
          size="$3"
          backgroundColor="rgba(0,0,0,0.55)"
          onPress={() => router.back()}
          pressStyle={{ opacity: 0.7 }}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </Button>
      </XStack>

      <ProfileStats
        posts={counters.posts}
        followers={counters.followers}
        following={counters.following}
      />
      <ProfileTabs active={activeTab} onChange={setActiveTab} />
    </YStack>
  );

  return (
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
  );
}

const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
});
