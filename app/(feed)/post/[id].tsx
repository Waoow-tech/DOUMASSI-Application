import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Bookmark, Heart, MessageCircle, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text as RNText,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack } from 'tamagui';

import type { PostCardPost } from '@/components/feed/PostCard';
import { MentionsText } from '@/components/MentionsText';
import { CommentsSheet } from '@/features/comments/components/CommentsSheet';
import {
  useIncrementPostShare,
  usePostDetail,
  useTogglePostBookmark,
  useTogglePostLike,
} from '@/features/feed/hooks/useFeed';
import { formatViewCount } from '@/utils/formatCount';

const HIT_SLOP = { top: 14, right: 14, bottom: 14, left: 14 };
const ACTION_RIGHT = 16;
const ACTION_BOTTOM = 110;
const ACCENT_NEON = '#10D970';
const LIKE_RED = '#FF3B30';
const SCRIM_BANDS = Array.from({ length: 10 }, (_, index) => {
  const progress = index / 9;
  return Number((progress * progress * 0.7).toFixed(3));
});

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return 'Il y a quelques instants';

  const elapsedMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return 'Il y a quelques instants';
  if (minutes < 60) return `Il y a ${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Il y a ${weeks}sem`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Il y a ${months}mois`;

  return `Il y a ${Math.floor(days / 365)}an`;
}

function ActionButton({
  label,
  count,
  children,
  onPress,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionButton}
    >
      {children}
      <Text color="#FFFFFF" fontSize={12} fontWeight="700" marginTop={4} textAlign="center">
        {formatViewCount(count)}
      </Text>
    </Pressable>
  );
}

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
  const mediaUrl = post.media_urls[0];

  if (!mediaUrl) {
    return <View style={styles.emptyBackground} />;
  }

  if (post.media_type === 'video') {
    return <VideoBackground uri={mediaUrl} />;
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

function Avatar({
  username,
  avatarUrl,
  onPress,
}: {
  username: string;
  avatarUrl: string | null;
  onPress: () => void;
}) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`Voir le profil de @${username}`}
      style={styles.avatarButton}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
      ) : (
        <Text color="#FFFFFF" fontSize={16} fontWeight="700">
          {initial}
        </Text>
      )}
    </Pressable>
  );
}

function BottomScrim() {
  return (
    <View pointerEvents="none" style={styles.scrim}>
      {SCRIM_BANDS.map((opacity) => (
        <View key={opacity} style={[styles.scrimBand, { opacity }]} />
      ))}
    </View>
  );
}

function Footer({ post, onOpenProfile }: { post: PostCardPost; onOpenProfile: () => void }) {
  const [captionTruncated, setCaptionTruncated] = useState(false);
  const [captionMeasured, setCaptionMeasured] = useState(false);
  const relativeTime = useMemo(() => formatRelativeTime(post.created_at), [post.created_at]);

  const handleCaptionLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (captionMeasured) return;
      setCaptionMeasured(true);
      setCaptionTruncated(event.nativeEvent.lines.length > 3);
    },
    [captionMeasured]
  );

  return (
    <YStack position="absolute" left={16} right={88} bottom={28} gap={10}>
      <XStack alignItems="center" gap={10}>
        <Avatar
          username={post.author_username}
          avatarUrl={post.author_avatar_url}
          onPress={onOpenProfile}
        />

        <Pressable
          onPress={onOpenProfile}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Voir le profil de @${post.author_username}`}
          style={styles.authorButton}
        >
          <Text color="#FFFFFF" fontSize={15} fontWeight="700" numberOfLines={1}>
            @{post.author_username}
          </Text>
          <Text color="rgba(255,255,255,0.78)" fontSize={12} marginTop={2} numberOfLines={1}>
            {relativeTime}
          </Text>
        </Pressable>
      </XStack>

      {post.content.trim() ? (
        <YStack>
          <MentionsText
            content={post.content}
            style={styles.captionText}
            numberOfLines={3}
            onTextLayout={handleCaptionLayout}
          />
          {captionTruncated ? <RNText style={styles.moreText}>...plus</RNText> : null}
        </YStack>
      ) : null}
    </YStack>
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
  return (
    <YStack flex={1} backgroundColor="#000000" alignItems="center" justifyContent="center" gap={16}>
      <StatusBar hidden />
      <Text color="#FFFFFF" fontSize={18} fontWeight="700">
        Post indisponible
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
        Retour
      </Button>
    </YStack>
  );
}

export default function PostDetailRoute() {
  const params = useLocalSearchParams<{ id?: string; focus?: string }>();
  const postId = typeof params.id === 'string' ? params.id : undefined;
  const shouldFocusComments = params.focus === 'comments';
  const insets = useSafeAreaInsets();
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);

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

  const handleShare = useCallback(async () => {
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
      Alert.alert('Partage indisponible', 'Impossible d’ouvrir le partage pour le moment.');
    }
  }, [post, shareMutation]);

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
          accessibilityLabel="Afficher ou masquer les contrôles du post"
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
              accessibilityLabel="Fermer le post"
              style={[styles.closeButton, { top: insets.top + 12 }]}
            >
              <X size={24} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>

            <YStack position="absolute" right={ACTION_RIGHT} bottom={ACTION_BOTTOM} gap={24}>
              <ActionButton
                label={`Aimer le post de @${post.author_username}`}
                count={post.like_count}
                onPress={handleLike}
              >
                <Animated.View>
                  <Heart
                    size={32}
                    color={post.liked_by_me ? LIKE_RED : '#FFFFFF'}
                    fill={post.liked_by_me ? LIKE_RED : 'transparent'}
                  />
                </Animated.View>
              </ActionButton>

              <ActionButton
                label={`Commenter le post de @${post.author_username}`}
                count={post.comment_count}
                onPress={handleComments}
              >
                <MessageCircle size={32} color="#FFFFFF" />
              </ActionButton>

              <ActionButton
                label={`Partager le post de @${post.author_username}`}
                count={post.share_count}
                onPress={() => void handleShare()}
              >
                <Send size={32} color="#FFFFFF" />
              </ActionButton>

              <ActionButton
                label={`Sauvegarder le post de @${post.author_username}`}
                count={post.bookmark_count}
                onPress={handleBookmark}
              >
                <Bookmark
                  size={32}
                  color={post.bookmarked_by_me ? ACCENT_NEON : '#FFFFFF'}
                  fill={post.bookmarked_by_me ? ACCENT_NEON : 'transparent'}
                />
              </ActionButton>
            </YStack>

            <Footer post={post} onOpenProfile={handleOpenProfile} />
          </>
        ) : null}
      </View>

      {postId ? (
        <CommentsSheet postId={postId} open={commentsOpen} onOpenChange={setCommentsOpen} />
      ) : null}
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
