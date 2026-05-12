import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { VerifiedBadge } from './VerifiedBadge';

export interface UserRowData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

interface UserRowProps {
  user: UserRowData;
  onPress: (userId: string) => void;
}

export function UserRow({ user, onPress }: UserRowProps) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      paddingHorizontal="$4"
      paddingVertical="$3"
      pressStyle={{ backgroundColor: '$surface' }}
      onPress={() => onPress(user.id)}
      cursor="pointer"
    >
      <YStack
        width={44}
        height={44}
        borderRadius={22}
        backgroundColor="$surface"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <User size={22} color="#A0A0A0" />
        )}
      </YStack>

      <YStack flex={1} minWidth={0} gap={2}>
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          <Text color="$color" fontSize={15} fontWeight="700" numberOfLines={1}>
            @{user.username}
          </Text>
          <VerifiedBadge isVerified={user.is_verified} />
        </XStack>
        <Text color="$textSecondary" fontSize={13} numberOfLines={1}>
          {user.full_name ?? ''}
        </Text>
      </YStack>
    </XStack>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
