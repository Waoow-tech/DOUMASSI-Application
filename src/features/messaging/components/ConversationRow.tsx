import { Image } from 'expo-image';
import { BellOff, User as UserIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import type { ConversationListRow } from '@/features/messaging/hooks/useMyConversations';
import { useTranslations, type Translations } from '@/i18n';

const AVATAR_SIZE = 52;

function formatTimeAgo(value: string, t: Translations) {
  const date = new Date(value);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const time = t.messaging.conversationRow.time;
  if (diffSeconds < 60) return time.now;
  if (diffMinutes < 60) return time.minutesAgo(diffMinutes);
  if (diffHours < 24) return time.hoursAgo(diffHours);
  if (diffDays < 7) return time.daysAgo(diffDays);

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatUnreadCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

export function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationListRow;
  onPress: () => void;
}) {
  const t = useTranslations();
  const preview =
    conversation.last_message_preview?.trim() || t.messaging.conversationRow.noMessage;
  const initial = conversation.display_name.charAt(0).toUpperCase() || '?';
  const hasUnread = conversation.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.messaging.conversationRow.conversationWith(conversation.display_name)}
    >
      <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center" gap="$3">
        <YStack
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          borderRadius={9999}
          backgroundColor="$surface"
          overflow="hidden"
          alignItems="center"
          justifyContent="center"
        >
          {conversation.display_avatar_url ? (
            <Image
              source={{ uri: conversation.display_avatar_url }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : conversation.is_group ? (
            <Text color="$color" fontSize={18} fontWeight="700">
              {initial}
            </Text>
          ) : (
            <UserIcon size={26} color="#A0A0A0" />
          )}
        </YStack>

        <YStack flex={1} minWidth={0} gap={4}>
          <XStack alignItems="center" gap="$2">
            <Text flex={1} color="$color" fontSize={16} fontWeight="700" numberOfLines={1}>
              {conversation.display_name}
            </Text>
            {conversation.muted ? <BellOff size={15} color="#A0A0A0" /> : null}
            <Text color="$textSecondary" fontSize={12} minWidth={42} textAlign="right">
              {formatTimeAgo(conversation.last_message_at, t)}
            </Text>
          </XStack>

          <XStack alignItems="center" gap="$2">
            <Text
              flex={1}
              color={hasUnread ? '$color' : '$textSecondary'}
              fontSize={14}
              fontWeight={hasUnread ? '700' : '400'}
              numberOfLines={1}
            >
              {preview}
            </Text>
            {hasUnread ? (
              <View
                minWidth={22}
                height={22}
                paddingHorizontal={6}
                borderRadius={9999}
                backgroundColor="#10D970"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="#000000" fontSize={12} fontWeight="700">
                  {formatUnreadCount(conversation.unread_count)}
                </Text>
              </View>
            ) : null}
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  );
}

export function ConversationRowSkeleton() {
  return (
    <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center" gap="$3">
      <View
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        borderRadius={9999}
        backgroundColor="$surface"
      />
      <YStack flex={1} gap="$2">
        <View width="48%" height={16} borderRadius={4} backgroundColor="$surface" />
        <View width="76%" height={14} borderRadius={4} backgroundColor="$surface" />
      </YStack>
    </XStack>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
