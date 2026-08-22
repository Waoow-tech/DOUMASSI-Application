// Skeleton de chargement pour les écrans profil — cover + avatar + texte
// + compteurs. Animation shimmer via Animated (opacity loop).

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import {
  PROFILE_AVATAR_BORDER_WIDTH,
  PROFILE_AVATAR_SIZE,
  PROFILE_COVER_HEIGHT,
} from './ProfileHeader';

function SkeletonBlock({
  width,
  height,
  borderRadius = 4,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
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

export function ProfileSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor="$background">
      <SkeletonBlock width="100%" height={PROFILE_COVER_HEIGHT + insets.top} borderRadius={0} />
      <YStack alignItems="center" marginTop={-(PROFILE_AVATAR_SIZE / 2)}>
        <SkeletonBlock
          width={PROFILE_AVATAR_SIZE + PROFILE_AVATAR_BORDER_WIDTH * 2}
          height={PROFILE_AVATAR_SIZE + PROFILE_AVATAR_BORDER_WIDTH * 2}
          borderRadius={9999}
        />
      </YStack>
      <YStack alignItems="center" marginTop={16} gap={8}>
        <SkeletonBlock width={140} height={20} borderRadius={6} />
        <SkeletonBlock width={100} height={14} borderRadius={6} />
      </YStack>
      <YStack alignItems="center" marginTop={12} gap={6}>
        <SkeletonBlock width={260} height={12} borderRadius={4} />
        <SkeletonBlock width={200} height={12} borderRadius={4} />
      </YStack>
      <XStack marginTop={20} paddingHorizontal={40} justifyContent="space-between">
        <SkeletonBlock width={60} height={36} borderRadius={6} />
        <SkeletonBlock width={60} height={36} borderRadius={6} />
        <SkeletonBlock width={60} height={36} borderRadius={6} />
      </XStack>
    </YStack>
  );
}
