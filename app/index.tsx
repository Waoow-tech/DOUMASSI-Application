import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Text, YStack } from 'tamagui';

import { FeedScreen } from '@/features/feed/screens/FeedScreen';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const opacity = useRef(new Animated.Value(1)).current;
  const [canShowFeed, setCanShowFeed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(async () => {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (data.session) {
          setCanShowFeed(true);
          return;
        }

        router.replace('/login');
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [opacity]);

  if (canShowFeed) {
    return <FeedScreen />;
  }

  return (
    <Animated.View style={{ flex: 1, opacity }}>
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Text fontSize={56} fontWeight="700" color="white" letterSpacing={4} fontFamily="$body">
          {t.splash.tagline}
        </Text>
      </YStack>
    </Animated.View>
  );
}
