import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, EyeOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { usePostDetail } from '@/features/feed/hooks/useFeed';
import { useHiddenPosts, useUnhidePost } from '@/features/feed/hooks/useHiddenPosts';
import { useTranslations } from '@/i18n';

function HiddenPostRow({ postId, onRestored }: { postId: string; onRestored: () => void }) {
  const t = useTranslations();
  const postQuery = usePostDetail(postId);
  const unhidePostMutation = useUnhidePost();
  const post = postQuery.data;

  const handleRestore = useCallback(() => {
    unhidePostMutation.mutate(postId, { onSuccess: onRestored });
  }, [onRestored, postId, unhidePostMutation]);

  return (
    <XStack
      minHeight={72}
      paddingHorizontal="$4"
      paddingVertical="$3"
      alignItems="center"
      gap="$3"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
    >
      <YStack
        width={44}
        height={44}
        borderRadius={9999}
        backgroundColor="$surfaceElevated"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {post?.author_avatar_url ? (
          <Image
            source={{ uri: post.author_avatar_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <Text color="$color" fontSize={16} fontWeight="700">
            {post?.author_username?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        )}
      </YStack>

      <YStack flex={1} minWidth={0} gap={3}>
        <Text color="$color" fontSize={15} fontWeight="700" numberOfLines={1}>
          {post
            ? `@${post.author_username}`
            : postQuery.isLoading
              ? t.profileScreens.hiddenPosts.loading
              : t.profileScreens.hiddenPosts.postUnavailable}
        </Text>
        <Text color="$textSecondary" fontSize={13} numberOfLines={1}>
          {post?.content?.trim() || postId}
        </Text>
      </YStack>

      <Button
        minHeight={38}
        paddingHorizontal="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$md"
        onPress={handleRestore}
        disabled={unhidePostMutation.isPending}
        pressStyle={{ opacity: 0.72 }}
      >
        {unhidePostMutation.isPending ? (
          <Spinner size="small" color="$accentNeon" />
        ) : (
          <Button.Text color="$accentNeon" fontSize={13} fontWeight="700">
            {t.profileScreens.hiddenPosts.restore}
          </Button.Text>
        )}
      </Button>
    </XStack>
  );
}

export default function HiddenPostsScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const hiddenPostsQuery = useHiddenPosts();
  const [toastVisible, setToastVisible] = useState(false);

  const showRestoredToast = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1600);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: string }) => <HiddenPostRow postId={item} onRestored={showRestoredToast} />,
    [showRestoredToast]
  );

  const EmptyState = useCallback(() => {
    if (hiddenPostsQuery.isLoading) {
      return (
        <YStack paddingVertical={100} alignItems="center">
          <Spinner size="large" color="#FFFFFF" />
        </YStack>
      );
    }

    return (
      <YStack paddingVertical={100} alignItems="center" gap="$3" paddingHorizontal="$6">
        <EyeOff size={48} color="#A0A0A0" />
        <Text color="$textSecondary" fontSize={16} fontWeight="600" textAlign="center">
          {t.profileScreens.hiddenPosts.emptyTitle}
        </Text>
      </YStack>
    );
  }, [hiddenPostsQuery.isLoading, t]);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <XStack
        height={56}
        paddingHorizontal="$4"
        alignItems="center"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
      >
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text
          flex={1}
          marginLeft="$3"
          color="$color"
          fontSize={20}
          fontWeight="700"
          fontFamily="$heading"
        >
          {t.profileScreens.hiddenPosts.title}
        </Text>
        <View width={24} />
      </XStack>

      <FlashList
        data={hiddenPostsQuery.data ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        ListEmptyComponent={EmptyState}
        onRefresh={() => void hiddenPostsQuery.refetch()}
        refreshing={hiddenPostsQuery.isRefetching}
        contentContainerStyle={styles.listContent}
      />

      {toastVisible ? (
        <XStack
          position="absolute"
          bottom={96}
          left={0}
          right={0}
          justifyContent="center"
          pointerEvents="none"
        >
          <XStack
            backgroundColor="$surface"
            paddingHorizontal="$4"
            paddingVertical="$3"
            borderRadius="$lg"
            alignItems="center"
            gap="$2"
          >
            <EyeOff size={16} color="#FFFFFF" />
            <Text color="$color" fontSize={14} fontWeight="600">
              {t.profileScreens.hiddenPosts.restoredToast}
            </Text>
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
  },
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
});
