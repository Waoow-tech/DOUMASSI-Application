// StoryViewersSheet — composant « Vu par » pour l'auteur d'une story.
// BottomSheet Tamagui qui liste les viewers via la RPC get_story_viewers
// (réservée à l'auteur — vérifié côté BDD, pas besoin de garde côté UI).

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Eye } from 'lucide-react-native';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Sheet, Text, XStack, YStack } from 'tamagui';

import { type StoryViewer, useStoryViewers } from '@/features/stories/hooks/useStoriesFeed';
import { getT, useTranslations } from '@/i18n';

function formatViewedAgo(value: string): string {
  const t = getT();
  const viewedAt = new Date(value).getTime();
  if (Number.isNaN(viewedAt)) return '';
  const elapsedMs = Math.max(0, Date.now() - viewedAt);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return t.feed.stories.viewers.time.justNow;
  if (minutes < 60) return t.feed.stories.viewers.time.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.feed.stories.viewers.time.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return t.feed.stories.viewers.time.daysAgo(days);
}

function ViewerRow({ viewer }: { viewer: StoryViewer }) {
  return (
    <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$3" gap="$3">
      {viewer.viewer_avatar_url ? (
        <Image
          source={{ uri: viewer.viewer_avatar_url }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <YStack
          style={styles.avatar}
          backgroundColor="$surface"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="$color" fontSize={14} fontWeight="700">
            {viewer.viewer_username.charAt(0).toUpperCase()}
          </Text>
        </YStack>
      )}
      <YStack flex={1} gap={2}>
        <Text color="$color" fontSize={15} fontWeight="600">
          @{viewer.viewer_username}
        </Text>
        <Text color="$textSecondary" fontSize={12}>
          {formatViewedAgo(viewer.viewed_at)}
        </Text>
      </YStack>
    </XStack>
  );
}

export type StoryViewersSheetProps = {
  storyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StoryViewersSheet({ storyId, open, onOpenChange }: StoryViewersSheetProps) {
  const t = useTranslations();
  const viewersQuery = useStoryViewers(storyId, open);
  const viewers = viewersQuery.data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: StoryViewer }) => <ViewerRow viewer={item} />,
    []
  );

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[70]} dismissOnSnapToBottom>
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.5)"
      />
      <Sheet.Frame backgroundColor="$surface" borderTopLeftRadius={16} borderTopRightRadius={16}>
        <XStack justifyContent="center" paddingTop="$3" paddingBottom="$2">
          <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColorHover" />
        </XStack>

        <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$2" gap="$2">
          <Eye size={18} color="#FFFFFF" />
          <Text color="$color" fontSize={17} fontWeight="700">
            {t.feed.stories.viewers.viewsLabel(viewers.length)}
          </Text>
        </XStack>

        {viewersQuery.isLoading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <ActivityIndicator color="#FFFFFF" />
          </YStack>
        ) : viewers.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$8" gap="$2">
            <Text color="$textSecondary" fontSize={14}>
              {t.feed.stories.viewers.empty}
            </Text>
          </YStack>
        ) : (
          <FlashList
            data={viewers}
            renderItem={renderItem}
            keyExtractor={(item) => item.viewer_id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: 32,
  },
});
