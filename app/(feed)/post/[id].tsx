import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, YStack } from 'tamagui';

import type { PostCardPost } from '@/components/feed/PostCard';
import { InternalShareOptionsSheet } from '@/components/share/InternalShareOptionsSheet';
import { CommentsSheet } from '@/features/comments/components/CommentsSheet';
// Chrome partagé avec le défilement vidéo plein écran (E14-02).
import {
  BottomScrim,
  HIT_SLOP,
  PostActionRail,
  PostFooter,
} from '@/features/feed/components/FullScreenPostOverlay';
import {
  useIncrementPostShare,
  usePostDetail,
  useTogglePostBookmark,
  useTogglePostLike,
} from '@/features/feed/hooks/useFeed';
import { getPostPosterUrl, getPostVideoUrl } from '@/features/feed/lib/postMedia';
import { useTranslations } from '@/i18n';

function VideoBackground({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function PostBackground({ post }: { post: PostCardPost }) {
  // Un post vidéo range [poster, vidéo] dans media_urls (cf. postMedia.ts) :
  // il faut lire l'entrée vidéo, pas la première.
  const videoUrl = getPostVideoUrl(post);
  if (videoUrl) {
    return <VideoBackground uri={videoUrl} />;
  }

  const mediaUrl = getPostPosterUrl(post);
  if (!mediaUrl) {
    return <View style={styles.emptyBackground} />;
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      recyclingKey={`${post.id}-${mediaUrl}`}
      transition={180}
    />
  );
}

function LiveBadge({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return undefined;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.liveBadge, { opacity }]}>
      <Text color="#FFFFFF" fontSize={12} fontWeight="700">
        LIVE
      </Text>
    </Animated.View>
  );
}

function LoadingState() {
  return (
    <View style={styles.centerState}>
      <StatusBar hidden />
      <ActivityIndicator color="#FFFFFF" size="large" />
    </View>
  );
}

function ErrorState() {
  const t = useTranslations();

  return (
    <YStack flex={1} backgroundColor="#000000" alignItems="center" justifyContent="center" gap={16}>
      <StatusBar hidden />
      <Text color="#FFFFFF" fontSize={18} fontWeight="700">
        {t.feed.postDetail.errorTitle}
      </Text>
      <Button
        height={44}
        borderRadius="$lg"
        backgroundColor="#FFFFFF"
        color="#000000"
        fontWeight="700"
        onPress={() => router.back()}
        pressStyle={{ opacity: 0.86, scale: 0.98 }}
      >
        {t.feed.postDetail.back}
      </Button>
    </YStack>
  );
}

export default function PostDetailRoute() {
  const t = useTranslations();
  const params = useLocalSearchParams<{ id?: string; focus?: string }>();
  const postId = typeof params.id === 'string' ? params.id : undefined;
  const shouldFocusComments = params.focus === 'comments';
  const insets = useSafeAreaInsets();
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const postQuery = usePostDetail(postId);
  const likeMutation = useTogglePostLike(postId ?? '');
  const bookmarkMutation = useTogglePostBookmark(postId ?? '');
  const shareMutation = useIncrementPostShare(postId ?? '');

  const post = postQuery.data;
  const hadAvailablePost = useRef(false);
  const didOpenFocusedComments = useRef(false);

  useEffect(() => {
    if (post) {
      hadAvailablePost.current = true;
    }
  }, [post]);

  useEffect(() => {
    if (hadAvailablePost.current && postQuery.data === null && !postQuery.isLoading) {
      router.back();
    }
  }, [postQuery.data, postQuery.isLoading]);

  useEffect(() => {
    if (!post || !shouldFocusComments || didOpenFocusedComments.current) return;

    didOpenFocusedComments.current = true;
    setCommentsOpen(true);
  }, [post, shouldFocusComments]);

  const handleToggleOverlays = useCallback(() => {
    setOverlaysVisible((current) => !current);
  }, []);

  const handleLike = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate();
  }, [likeMutation]);

  const handleBookmark = useCallback(() => {
    void Haptics.selectionAsync();
    bookmarkMutation.mutate();
  }, [bookmarkMutation]);

  const handleComments = useCallback(() => {
    setCommentsOpen(true);
  }, []);

  const handleShareOutside = useCallback(async () => {
    if (!post) return;

    try {
      const result = await Share.share({
        message: post.content.trim()
          ? `${post.content}\n\nhttps://doumassi.app/post/${post.id}`
          : `https://doumassi.app/post/${post.id}`,
      });

      if (result.action === Share.sharedAction) {
        shareMutation.mutate();
      }
    } catch {
      // Annulation par l'utilisateur ou erreur native.
    }
  }, [post, shareMutation]);

  const handleShareInside = useCallback(() => {
    if (!post) return;
    router.push({
      pathname: '/messages/share',
      params: { type: 'post', postId: post.id },
    });
  }, [post]);

  const handleOpenProfile = useCallback(() => {
    if (!post) return;
    router.push(`/profile/${post.author_id}`);
  }, [post]);

  if (postQuery.isLoading) {
    return <LoadingState />;
  }

  if (postQuery.isError || !post) {
    return <ErrorState />;
  }

  const isLive = Boolean((post as PostCardPost & { is_live?: boolean }).is_live);

  return (
    <>
      <View style={styles.screen}>
        <StatusBar hidden />
        <Pressable
          onPress={handleToggleOverlays}
          onLongPress={() => {}}
          delayLongPress={240}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t.feed.postDetail.toggleOverlaysA11y}
        >
          <PostBackground post={post} />
        </Pressable>

        {overlaysVisible ? (
          <>
            <BottomScrim />
            <LiveBadge visible={isLive} />

            <Pressable
              onPress={() => router.back()}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t.feed.postDetail.closeA11y}
              style={[styles.closeButton, { top: insets.top + 12 }]}
            >
              <X size={24} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>

            <PostActionRail
              post={post}
              onLike={handleLike}
              onComments={handleComments}
              onShare={() => setShareSheetOpen(true)}
              onBookmark={handleBookmark}
            />

            <PostFooter post={post} onOpenProfile={handleOpenProfile} />
          </>
        ) : null}
      </View>

      {postId ? (
        <CommentsSheet postId={postId} open={commentsOpen} onOpenChange={setCommentsOpen} />
      ) : null}
      <InternalShareOptionsSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        onShareOutside={() => void handleShareOutside()}
        onShareInside={handleShareInside}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 48,
  },
  authorButton: {
    flexShrink: 1,
    minWidth: 0,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
  },
  centerState: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  liveBadge: {
    position: 'absolute',
    top: 54,
    left: 16,
    borderRadius: 999,
    backgroundColor: '#FF2D55',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
  },
  scrimBand: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
