// Écran Splash applicatif (premier écran après le boot natif).
// Ticket E1-17 + E2-03 — affiche "DOUMASSI" 1s, fade-out 1s,
// puis redirige vers /feed si session active, /login sinon.

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text, YStack } from 'tamagui';

import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

export default function Splash() {
  const opacity = useRef(new Animated.Value(1)).current;

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

        router.replace(data.session ? '/feed' : '/login');
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [opacity]);

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
