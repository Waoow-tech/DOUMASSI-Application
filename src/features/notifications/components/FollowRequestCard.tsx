// FollowRequestCard — E4-17.
// Card affichée en haut de l'écran Notifications pour chaque demande de
// suivi (`type='follow_request'`). 2 boutons inline : Confirmer / Refuser,
// avec optimistic remove de la row au tap (les hooks accept/reject
// invalident la liste côté success / rollback côté erreur).

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';

import {
  useAcceptFollowRequest,
  useRejectFollowRequest,
  type NotificationItem,
} from '@/features/notifications/hooks/useNotifications';

const AVATAR_SIZE = 40;

export interface FollowRequestCardProps {
  notif: NotificationItem;
}

export const FollowRequestCard = memo(function FollowRequestCard({
  notif,
}: FollowRequestCardProps) {
  const accept = useAcceptFollowRequest();
  const reject = useRejectFollowRequest();
  const isPending = accept.isPending || reject.isPending;
  const requesterId = notif.actor_id;
  const username = notif.actor_username ?? 'inconnu';

  if (!requesterId) {
    // Notif sans acteur : on ne devrait jamais arriver ici pour follow_request.
    return null;
  }

  const handleAccept = () => {
    if (isPending) return;
    accept.mutate(requesterId);
  };

  const handleReject = () => {
    if (isPending) return;
    reject.mutate(requesterId);
  };

  const handleOpenProfile = () => {
    router.push(`/profile/${requesterId}`);
  };

  return (
    <YStack
      backgroundColor="$surface"
      borderRadius="$4"
      marginHorizontal="$4"
      marginBottom="$2"
      padding="$3"
      gap="$3"
    >
      <XStack alignItems="center" gap="$3">
        <Pressable onPress={handleOpenProfile}>
          {notif.actor_avatar_url ? (
            <Image
              source={{ uri: notif.actor_avatar_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <YStack
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              borderRadius={9999}
              backgroundColor="$backgroundFocus"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$color" fontSize={16} fontWeight="700">
                {username.charAt(0).toUpperCase()}
              </Text>
            </YStack>
          )}
        </Pressable>

        <Pressable onPress={handleOpenProfile} style={styles.textPressable}>
          <Text color="$color" fontSize={15} fontWeight="700">
            @{username}{' '}
            <Text color="$textSecondary" fontWeight="400">
              veut vous suivre
            </Text>
          </Text>
        </Pressable>

        {!notif.is_seen ? <YStack style={styles.unreadDot} /> : null}
      </XStack>

      <XStack gap="$2">
        <Button
          flex={1}
          height={36}
          borderRadius={8}
          backgroundColor="#FFFFFF"
          color="#000000"
          fontWeight="700"
          fontSize={14}
          disabled={isPending}
          opacity={isPending ? 0.6 : 1}
          onPress={handleAccept}
          pressStyle={{ opacity: 0.85 }}
        >
          {accept.isPending ? <ActivityIndicator color="#000000" /> : 'Confirmer'}
        </Button>
        <Button
          flex={1}
          height={36}
          borderRadius={8}
          backgroundColor="$surface"
          borderWidth={1}
          borderColor="$borderColor"
          color="$color"
          fontWeight="600"
          fontSize={14}
          disabled={isPending}
          opacity={isPending ? 0.6 : 1}
          onPress={handleReject}
          pressStyle={{ opacity: 0.85 }}
        >
          {reject.isPending ? <ActivityIndicator color="#FFFFFF" /> : 'Refuser'}
        </Button>
      </XStack>
    </YStack>
  );
});

const styles = StyleSheet.create({
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 9999,
  },
  textPressable: {
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
});
