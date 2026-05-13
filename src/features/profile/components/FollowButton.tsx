// Bouton Follow adaptatif — E3-03.
// Affiche un état différent selon le FollowStatus :
//   idle     → "Follow" (filled primary)
//   pending  → "Requested ✕" (outlined gris, tap → cancel request)
//   following → "Following" (outlined, tap → ouvre modale unfollow)
//   self     → null (pas de bouton sur son propre profil)

import { Button, Spinner } from 'tamagui';

import type { FollowStatus } from '@/features/profile/hooks/useFollow';

interface FollowButtonProps {
  status: FollowStatus;
  isPending: boolean;
  onFollow: () => void;
  onUnfollowRequest: () => void;
  onCancelRequest: () => void;
}

export function FollowButton({
  status,
  isPending,
  onFollow,
  onUnfollowRequest,
  onCancelRequest,
}: FollowButtonProps) {
  if (status === 'self') return null;

  if (isPending) {
    return (
      <Button flex={1} height={40} backgroundColor="$accentNeon" borderRadius="$lg" disabled>
        <Spinner size="small" color="#000000" />
      </Button>
    );
  }

  if (status === 'idle') {
    return (
      <Button
        flex={1}
        height={40}
        backgroundColor="$accentNeon"
        borderRadius="$lg"
        color="#000000"
        fontWeight="700"
        fontSize={14}
        onPress={onFollow}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
      >
        Follow
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button
        flex={1}
        height={40}
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$color"
        borderRadius="$lg"
        color="$color"
        fontWeight="600"
        fontSize={14}
        onPress={onCancelRequest}
        pressStyle={{ opacity: 0.7, scale: 0.98 }}
      >
        Requested ✕
      </Button>
    );
  }

  // status === 'following'
  return (
    <Button
      flex={1}
      height={40}
      backgroundColor="transparent"
      borderWidth={1}
      borderColor="$borderColorHover"
      borderRadius="$lg"
      color="$color"
      fontWeight="600"
      fontSize={14}
      onPress={onUnfollowRequest}
      pressStyle={{ opacity: 0.7, scale: 0.98 }}
    >
      Following
    </Button>
  );
}
