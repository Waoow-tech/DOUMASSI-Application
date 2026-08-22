// NotificationRow — E4-17.
// Row affichée pour chaque notif non-follow_request (follow/like/comment/
// mention/system/payment). Le tap déclenche onPress (le screen route en
// conséquence du type + marque lu).

import { Image } from 'expo-image';
import { Bell, Sparkles } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type {
  NotificationItem,
  NotificationType,
} from '@/features/notifications/hooks/useNotifications';
import { useTranslations, type Translations } from '@/i18n';

const AVATAR_SIZE = 40;

function formatNotifTime(value: string, t: Translations): string {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return '';
  const time = t.notifications.row.time;
  const elapsedMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return time.now;
  if (minutes < 60) return time.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return time.hours(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return time.days(days);
  const weeks = Math.floor(days / 7);
  if (days < 30) return time.weeks(weeks);
  // Au-delà de 30 jours : date format JJ/MM/AAAA.
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function buildText(notif: NotificationItem, t: Translations): string {
  const nt = t.notifications.row;
  const handle = notif.actor_username ? `@${notif.actor_username}` : nt.unknownUser;
  switch (notif.type) {
    case 'follow':
      return nt.startedFollowingYou(handle);
    case 'like':
      return nt.likedYourPost(handle);
    case 'comment': {
      const preview = (notif.payload?.preview as string | undefined)?.trim();
      return preview ? nt.commentedWithPreview(handle, preview) : nt.commentedYourPost(handle);
    }
    case 'mention':
      return nt.mentionedYou(handle);
    case 'system': {
      const title = (notif.payload?.title as string | undefined) ?? nt.systemNewsTitleFallback;
      return nt.systemNews(title);
    }
    case 'payment': {
      const from = (notif.payload?.from as string | undefined) ?? nt.paymentUnknownSender;
      const amount = (notif.payload?.amount as string | undefined) ?? '';
      return amount ? nt.paymentWithAmount(from, amount) : nt.paymentAccepted(from);
    }
    case 'follow_request':
      // Ne devrait pas atterrir ici (rendu via FollowRequestCard) — fallback.
      return nt.wantsToFollowYou(handle);
    default:
      return '';
  }
}

const SYSTEM_TYPES: NotificationType[] = ['system', 'payment'];

function ActorAvatar({ notif }: { notif: NotificationItem }) {
  if (notif.actor_avatar_url) {
    return (
      <Image source={{ uri: notif.actor_avatar_url }} style={styles.avatar} contentFit="cover" />
    );
  }
  // Pas d'acteur (notif système) → icône d'avatar à la place.
  if (SYSTEM_TYPES.includes(notif.type) || !notif.actor_id) {
    return (
      <YStack
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        borderRadius={9999}
        backgroundColor="$surface"
        alignItems="center"
        justifyContent="center"
      >
        {notif.type === 'system' ? (
          <Sparkles size={20} color="#FFFFFF" />
        ) : (
          <Bell size={20} color="#FFFFFF" />
        )}
      </YStack>
    );
  }
  const initial = notif.actor_username?.trim().charAt(0).toUpperCase() ?? '?';
  return (
    <YStack
      width={AVATAR_SIZE}
      height={AVATAR_SIZE}
      borderRadius={9999}
      backgroundColor="$surface"
      alignItems="center"
      justifyContent="center"
    >
      <Text color="$color" fontSize={16} fontWeight="700">
        {initial}
      </Text>
    </YStack>
  );
}

export interface NotificationRowProps {
  notif: NotificationItem;
  onPress: (notif: NotificationItem) => void;
}

export const NotificationRow = memo(function NotificationRow({
  notif,
  onPress,
}: NotificationRowProps) {
  const t = useTranslations();
  const text = buildText(notif, t);
  const time = formatNotifTime(notif.created_at, t);

  return (
    <Pressable
      onPress={() => onPress(notif)}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$3" gap="$3">
        <ActorAvatar notif={notif} />

        <YStack flex={1} gap={2}>
          <Text color="$color" fontSize={15} fontWeight={notif.is_read ? '400' : '600'}>
            {text}
          </Text>
        </YStack>

        <XStack alignItems="center" gap="$2">
          <Text color="$textSecondary" fontSize={12}>
            {time}
          </Text>
          {!notif.is_seen ? <YStack style={styles.unreadDot} /> : null}
        </XStack>
      </XStack>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: {
    backgroundColor: '#000000',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 9999,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
});
