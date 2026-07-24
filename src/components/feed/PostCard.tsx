import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Play, Send } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  Share,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { MentionsText } from '@/components/MentionsText';
import { InternalShareOptionsSheet } from '@/components/share/InternalShareOptionsSheet';
import { getPostImageCount, getPostPosterUrl } from '@/features/feed/lib/postMedia';
import { getT, useTranslations } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { formatViewCount } from '@/utils/formatCount';

export type PostCardPost = {
  id: string;
  author_id: string;
  author_username: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  content: string;
  media_urls: string[];
  media_type: 'text' | 'image' | 'video';
  created_at: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  bookmark_count: number;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
};

export type PostCardProps = {
  post: PostCardPost;
  variant?: 'feed' | 'detail' | 'thumbnail';
  onLike?: () => void;
  onBookmark?: () => void;
  onShare?: () => void;
  onOpenDetail?: () => void;
  onOpenComments?: () => void;
  onOpenProfile?: () => void;
  onMenuPress?: () => void;
};

const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };
const TEXT_LINE_HEIGHT = 22;
const MAX_CONTENT_LINES = 6;

function formatRelativeTime(value: string) {
  const t = getT();
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return t.feed.time.justNow;

  const elapsedMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return t.feed.time.justNow;
  if (minutes < 60) return t.feed.time.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.feed.time.hours(hours);

  const days = Math.floor(hours / 24);
  if (days < 7) return t.feed.time.days(days);

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t.feed.time.weeks(weeks);

  const months = Math.floor(days / 30);
  if (months < 12) return t.feed.time.months(months);

  return t.feed.time.years(Math.floor(days / 365));
}

function Avatar({
  username,
  avatarUrl,
  onPress,
}: {
  username: string;
  avatarUrl: string | null;
  onPress?: () => void;
}) {
  const t = useTranslations();
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t.feed.postCard.viewProfileA11y(username)}
    >
      <YStack
        width={40}
        height={40}
        borderRadius={9999}
        backgroundColor="$surface"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text color="$color" fontSize={16} fontWeight="700">
            {initial}
          </Text>
        )}
      </YStack>
    </Pressable>
  );
}

function CountAction({
  label,
  hint,
  count,
  children,
  onPress,
}: {
  label: string;
  hint?: string;
  count?: number;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.actionPressable}
    >
      <XStack alignItems="center" gap={6}>
        {children}
        {typeof count === 'number' ? (
          <Text color="$color" fontSize={13} fontWeight="500">
            {formatViewCount(count)}
          </Text>
        ) : null}
      </XStack>
    </Pressable>
  );
}

function PostContent({ content, onOpenDetail }: { content: string; onOpenDetail?: () => void }) {
  const t = useTranslations();
  const [isTruncated, setIsTruncated] = useState(false);
  const [measured, setMeasured] = useState(false);

  const onTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (measured) return;
      setMeasured(true);
      setIsTruncated(event.nativeEvent.lines.length > MAX_CONTENT_LINES);
    },
    [measured]
  );

  if (!content.trim()) return null;

  return (
    <Pressable
      onPress={onOpenDetail}
      accessibilityRole="button"
      accessibilityLabel={t.feed.postCard.openPost}
      style={styles.contentPressable}
    >
      <MentionsText
        content={content}
        style={styles.contentText}
        numberOfLines={MAX_CONTENT_LINES}
        onTextLayout={onTextLayout}
      />
      {isTruncated ? (
        <Text color="$textSecondary" fontSize={15} lineHeight={TEXT_LINE_HEIGHT} marginTop={2}>
          {t.feed.postCard.seeMore}
        </Text>
      ) : null}
    </Pressable>
  );
}

function PostMedia({
  post,
  onOpenDetail,
  thumbnail,
}: {
  post: PostCardPost;
  onOpenDetail?: () => void;
  thumbnail?: boolean;
}) {
  const t = useTranslations();
  // Vidéo → poster ; image → 1re image (cf. postMedia.ts pour la convention).
  const firstMediaUrl = getPostPosterUrl(post);
  if (!firstMediaUrl) return null;

  // Une vidéo occupe 2 entrées de media_urls ([poster, vidéo]) sans être 2
  // médias : la pastille « +N » ne doit compter que les images.
  const imageCount = getPostImageCount(post);

  const image = (
    <>
      <Image
        source={{ uri: firstMediaUrl }}
        style={thumbnail ? styles.thumbnailImage : styles.mediaImage}
        contentFit="cover"
        recyclingKey={`${post.id}-${firstMediaUrl}`}
        transition={200}
      />
      {post.media_type === 'video' ? (
        <YStack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <YStack
            width={48}
            height={48}
            borderRadius={9999}
            backgroundColor="rgba(0,0,0,0.38)"
            alignItems="center"
            justifyContent="center"
          >
            <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
          </YStack>
        </YStack>
      ) : null}
      {imageCount > 1 ? (
        <YStack
          position="absolute"
          top={10}
          right={10}
          backgroundColor="rgba(0,0,0,0.58)"
          borderRadius={9999}
          paddingHorizontal={8}
          paddingVertical={3}
          pointerEvents="none"
        >
          <Text color="#FFFFFF" fontSize={12} fontWeight="700">
            1/{imageCount}
          </Text>
        </YStack>
      ) : null}
    </>
  );

  if (thumbnail) {
    return (
      <Pressable
        onPress={onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={t.feed.postCard.openPost}
      >
        <YStack aspectRatio={1} width="100%" overflow="hidden" backgroundColor="$surface">
          {image}
        </YStack>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onOpenDetail}
      accessibilityRole="button"
      accessibilityLabel={t.feed.postCard.openPostMedia}
      style={styles.mediaPressable}
    >
      <YStack aspectRatio={4 / 5} width="100%" borderRadius={12} overflow="hidden">
        {image}
      </YStack>
    </Pressable>
  );
}

export const PostCard = memo(function PostCard({
  post,
  variant = 'feed',
  onLike,
  onBookmark,
  onShare,
  onOpenDetail,
  onOpenComments,
  onOpenProfile,
  onMenuPress,
}: PostCardProps) {
  const t = useTranslations();
  const likeScale = useRef(new Animated.Value(1)).current;
  const bookmarkSpin = useRef(new Animated.Value(0)).current;
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  useEffect(() => {
    bookmarkSpin.setValue(0);
  }, [bookmarkSpin]);

  const hasContent = post.content.trim().length > 0;
  const hasMedia = post.media_urls.length > 0;

  const relativeTime = useMemo(() => formatRelativeTime(post.created_at), [post.created_at]);

  const handleLike = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
    onLike?.();
  }, [likeScale, onLike]);

  const handleBookmark = useCallback(() => {
    bookmarkSpin.setValue(0);
    Animated.timing(bookmarkSpin, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    onBookmark?.();
  }, [bookmarkSpin, onBookmark]);

  const handleShareOutside = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }

    try {
      const result = await Share.share({ message: `https://doumassi.app/post/${post.id}` });
      if (result.action === Share.sharedAction) {
        await supabase.rpc('increment_share_count', { p_post_id: post.id });
      }
    } catch {
      // Annulation par l'utilisateur ou erreur native : le caller peut passer
      // onShare pour gérer l'état lui-même.
    }
  }, [onShare, post.id]);

  const handleShareInside = useCallback(() => {
    router.push({
      pathname: '/messages/share',
      params: { type: 'post', postId: post.id },
    });
  }, [post.id]);

  const bookmarkRotation = bookmarkSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!hasContent && !hasMedia) return null;

  if (variant === 'thumbnail') {
    return <PostMedia post={post} onOpenDetail={onOpenDetail} thumbnail />;
  }

  return (
    <>
      <YStack
        width="100%"
        paddingHorizontal={16}
        paddingTop={14}
        paddingBottom={12}
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
        backgroundColor="$background"
      >
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
            accessibilityLabel={t.feed.postCard.viewProfileA11y(post.author_username)}
            style={styles.authorPressable}
          >
            <XStack alignItems="baseline" flexShrink={1} gap={5}>
              <Text color="$color" fontSize={15} fontWeight="700" numberOfLines={1}>
                @{post.author_username}
              </Text>
              <Text color="$textSecondary" fontSize={13} numberOfLines={1}>
                · {relativeTime}
              </Text>
            </XStack>
          </Pressable>

          <XStack flex={1} />

          {onMenuPress ? (
            <Pressable
              onPress={onMenuPress}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t.feed.postCard.openMenuA11y(post.author_username)}
            >
              <MoreHorizontal size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </XStack>

        <YStack marginTop={10}>
          <PostContent content={post.content} onOpenDetail={onOpenDetail} />
          {hasMedia ? <PostMedia post={post} onOpenDetail={onOpenDetail} /> : null}
        </YStack>

        {variant === 'detail' ? null : (
          <XStack alignItems="center" gap={20} marginTop={12} width="100%">
            <CountAction
              label={t.feed.postCard.likeA11y(post.author_username)}
              hint={post.liked_by_me ? t.feed.postCard.likeHintRemove : t.feed.postCard.likeHintAdd}
              count={post.like_count}
              onPress={handleLike}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Heart
                  size={22}
                  color={post.liked_by_me ? '#FF3B30' : '#FFFFFF'}
                  fill={post.liked_by_me ? '#FF3B30' : 'transparent'}
                />
              </Animated.View>
            </CountAction>

            <CountAction
              label={t.feed.postCard.commentA11y(post.author_username)}
              count={post.comment_count}
              onPress={onOpenComments}
            >
              <MessageCircle size={22} color="#FFFFFF" />
            </CountAction>

            <CountAction
              label={t.feed.postCard.shareA11y(post.author_username)}
              count={post.share_count}
              onPress={() => setShareSheetOpen(true)}
            >
              <Send size={22} color="#FFFFFF" />
            </CountAction>

            <XStack flex={1} />

            <CountAction
              label={t.feed.postCard.bookmarkA11y(post.author_username)}
              hint={
                post.bookmarked_by_me
                  ? t.feed.postCard.bookmarkHintRemove
                  : t.feed.postCard.bookmarkHintAdd
              }
              onPress={handleBookmark}
            >
              <Animated.View style={{ transform: [{ rotate: bookmarkRotation }] }}>
                <Bookmark
                  size={22}
                  color={post.bookmarked_by_me ? '#10D970' : '#FFFFFF'}
                  fill={post.bookmarked_by_me ? '#10D970' : 'transparent'}
                />
              </Animated.View>
            </CountAction>
          </XStack>
        )}
      </YStack>

      <InternalShareOptionsSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        onShareOutside={() => void handleShareOutside()}
        onShareInside={handleShareInside}
      />
    </>
  );
});

function SkeletonBlock({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#2A2A2A',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function PostCardSkeleton() {
  return (
    <YStack
      width="100%"
      paddingHorizontal={16}
      paddingTop={14}
      paddingBottom={12}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
      backgroundColor="$background"
    >
      <XStack alignItems="center" gap={10}>
        <SkeletonBlock width={40} height={40} borderRadius={9999} />
        <YStack gap={7} flex={1}>
          <SkeletonBlock width={130} height={15} />
          <SkeletonBlock width={80} height={13} />
        </YStack>
        <SkeletonBlock width={20} height={20} borderRadius={9999} />
      </XStack>

      <YStack marginTop={12} gap={7}>
        <SkeletonBlock width="92%" height={14} />
        <SkeletonBlock width="74%" height={14} />
      </YStack>

      <SkeletonBlock width="100%" height={360} borderRadius={12} style={styles.skeletonMedia} />
    </YStack>
  );
}

const styles = StyleSheet.create({
  actionPressable: {
    minHeight: 30,
    justifyContent: 'center',
  },
  authorPressable: {
    flexShrink: 1,
    minWidth: 0,
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  contentPressable: {
    alignSelf: 'stretch',
  },
  contentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: TEXT_LINE_HEIGHT,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  mediaPressable: {
    marginTop: 8,
  },
  skeletonMedia: {
    marginTop: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});
