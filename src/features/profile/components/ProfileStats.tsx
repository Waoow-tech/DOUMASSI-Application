// 3 compteurs cliquables : posts / followers / following.
// Le handler onPress est optionnel par compteur (ex : Posts n'est pas
// toujours cliquable).

import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

interface ProfileStatsProps {
  posts: number;
  followers: number;
  following: number;
  onPostsPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

function StatCounter({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <YStack alignItems="center" flex={1}>
      <Text fontSize={20} fontWeight="700" color="$color" fontFamily="$heading">
        {value}
      </Text>
      <Text fontSize={12} color="$textSecondary" marginTop={2}>
        {label}
      </Text>
    </YStack>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export function ProfileStats({
  posts,
  followers,
  following,
  onPostsPress,
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsProps) {
  const t = useTranslations();
  const copy = t.profile;
  return (
    <XStack marginTop="$4" paddingHorizontal="$5" justifyContent="center" alignItems="center">
      <StatCounter value={posts} label={copy.stats.posts} onPress={onPostsPress} />
      <StatCounter value={followers} label={copy.stats.followers} onPress={onFollowersPress} />
      <StatCounter value={following} label={copy.stats.following} onPress={onFollowingPress} />
    </XStack>
  );
}

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
  },
});
