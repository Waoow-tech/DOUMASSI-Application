// Chrome d'un post plein écran — extrait de app/(feed)/post/[id].tsx par E14-02.
//
// POURQUOI CETTE EXTRACTION
//
// Le défilement vidéo (E14-02) affiche exactement la même surface que l'écran
// de détail d'un post : voile bas, rail d'actions à droite, auteur + légende en
// bas à gauche. Dupliquer ces ~200 lignes aurait garanti une dérive visuelle
// entre les deux écrans à la première retouche.
//
// Ce fichier ne contient QUE de la présentation : aucun appel réseau, aucune
// mutation. Les deux écrans gardent la maîtrise de leurs handlers et de leur
// cycle de vie — c'est là qu'ils diffèrent réellement (un post fixe d'un côté,
// un pager avec gestion des lecteurs vidéo de l'autre).

import { Image } from 'expo-image';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type { PostCardPost } from '@/components/feed/PostCard';
import { MentionsText } from '@/components/MentionsText';
import { getT, useTranslations } from '@/i18n';
import { formatViewCount } from '@/utils/formatCount';

export const HIT_SLOP = { top: 14, right: 14, bottom: 14, left: 14 };
export const ACCENT_NEON = '#10D970';
export const LIKE_RED = '#FF3B30';

const ACTION_RIGHT = 16;
const ACTION_BOTTOM = 110;

/** Dégradé bas simulé par bandes : évite une dépendance à expo-linear-gradient. */
const SCRIM_BANDS = Array.from({ length: 10 }, (_, index) => {
  const progress = index / 9;
  return Number((progress * progress * 0.7).toFixed(3));
});

export function formatRelativeTime(value: string) {
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

export function ActionButton({
  label,
  count,
  onPress,
  children,
}: {
  label: string;
  count: number;
  onPress: () => void;
  children: ReactNode;
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

function Avatar({
  username,
  avatarUrl,
  onPress,
}: {
  username: string;
  avatarUrl: string | null;
  onPress: () => void;
}) {
  const t = useTranslations();
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t.feed.postCard.viewProfileA11y(username)}
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

export function BottomScrim() {
  return (
    <View pointerEvents="none" style={styles.scrim}>
      {SCRIM_BANDS.map((opacity) => (
        <View key={opacity} style={[styles.scrimBand, { opacity }]} />
      ))}
    </View>
  );
}

export function PostFooter({
  post,
  onOpenProfile,
}: {
  post: PostCardPost;
  onOpenProfile: () => void;
}) {
  const t = useTranslations();
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
          accessibilityLabel={t.feed.postCard.viewProfileA11y(post.author_username)}
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
          {captionTruncated ? (
            <RNText style={styles.moreText}>{t.feed.postCard.seeMore}</RNText>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

/** Rail d'actions vertical (like / commenter / partager / sauvegarder). */
export function PostActionRail({
  post,
  onLike,
  onComments,
  onShare,
  onBookmark,
}: {
  post: PostCardPost;
  onLike: () => void;
  onComments: () => void;
  onShare: () => void;
  onBookmark: () => void;
}) {
  const t = useTranslations();

  return (
    <YStack position="absolute" right={ACTION_RIGHT} bottom={ACTION_BOTTOM} gap={24}>
      <ActionButton
        label={t.feed.postCard.likeA11y(post.author_username)}
        count={post.like_count}
        onPress={onLike}
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
        label={t.feed.postCard.commentA11y(post.author_username)}
        count={post.comment_count}
        onPress={onComments}
      >
        <MessageCircle size={32} color="#FFFFFF" />
      </ActionButton>

      <ActionButton
        label={t.feed.postCard.shareA11y(post.author_username)}
        count={post.share_count}
        onPress={onShare}
      >
        <Send size={32} color="#FFFFFF" />
      </ActionButton>

      <ActionButton
        label={t.feed.postCard.bookmarkA11y(post.author_username)}
        count={post.bookmark_count}
        onPress={onBookmark}
      >
        <Bookmark
          size={32}
          color={post.bookmarked_by_me ? ACCENT_NEON : '#FFFFFF'}
          fill={post.bookmarked_by_me ? ACCENT_NEON : 'transparent'}
        />
      </ActionButton>
    </YStack>
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
  moreText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 1,
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
