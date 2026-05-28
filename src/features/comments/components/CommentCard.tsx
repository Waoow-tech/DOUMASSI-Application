import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type { Comment } from '@/features/comments/hooks/useComments';
import { formatViewCount } from '@/utils/formatCount';

type CommentCardProps = {
  comment: Comment;
  currentUserId: string | null;
  nested?: boolean;
  onReply: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  onToggleLike: (commentId: string) => void;
};

const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };
const LIKE_RED = '#FF3B30';

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return '1min';

  const elapsedMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return '1min';
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}sem`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mois`;

  return `${Math.floor(days / 365)}an`;
}

function Avatar({ comment, size }: { comment: Comment; size: number }) {
  const initial = comment.author_username.trim().charAt(0).toUpperCase() || '?';

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={9999}
      backgroundColor="$surfaceElevated"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      flexShrink={0}
    >
      {comment.author_avatar_url ? (
        <Image
          source={{ uri: comment.author_avatar_url }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Text color="$color" fontSize={size === 32 ? 13 : 12} fontWeight="700">
          {initial}
        </Text>
      )}
    </YStack>
  );
}

export function CommentCard({
  comment,
  currentUserId,
  nested = false,
  onReply,
  onDelete,
  onToggleLike,
}: CommentCardProps) {
  const isAuthor = currentUserId === comment.author_id;
  const relativeTime = formatRelativeTime(comment.created_at);
  const avatarSize = nested ? 28 : 32;

  const handleLongPress = () => {
    if (!isAuthor) return;

    void Haptics.selectionAsync();
    Alert.alert('Supprimer ce commentaire ?', 'Cette action retirera le commentaire du post.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => onDelete(comment.id),
      },
    ]);
  };

  const handleLike = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleLike(comment.id);
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={380}
      accessibilityRole="text"
      style={[styles.row, nested ? styles.nestedRow : null]}
    >
      <Avatar comment={comment} size={avatarSize} />

      <YStack flex={1} minWidth={0} gap={5}>
        <XStack alignItems="baseline" gap={6} flexWrap="wrap">
          <Text color="$color" fontSize={14} fontWeight="700">
            @{comment.author_username}
          </Text>
          <Text color="$textSecondary" fontSize={12}>
            {relativeTime}
          </Text>
        </XStack>

        <Text color="$color" fontSize={14} lineHeight={20}>
          {comment.content}
        </Text>

        {!nested ? (
          <Pressable
            onPress={() => onReply(comment)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Répondre à @${comment.author_username}`}
            style={styles.replyButton}
          >
            <Text color="$textSecondary" fontSize={12} fontWeight="700">
              Répondre
            </Text>
          </Pressable>
        ) : null}
      </YStack>

      <Pressable
        onPress={handleLike}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`Aimer le commentaire de @${comment.author_username}`}
        style={styles.likeButton}
      >
        <Heart
          size={18}
          color={comment.liked_by_me ? LIKE_RED : '#A1A1AA'}
          fill={comment.liked_by_me ? LIKE_RED : 'transparent'}
        />
        <Text color="$textSecondary" fontSize={12} fontWeight="600" marginTop={3}>
          {formatViewCount(comment.like_count)}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  likeButton: {
    alignItems: 'center',
    minWidth: 34,
    paddingTop: 2,
  },
  nestedRow: {
    marginLeft: 32,
    paddingTop: 5,
  },
  replyButton: {
    alignSelf: 'flex-start',
    minHeight: 24,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
});
