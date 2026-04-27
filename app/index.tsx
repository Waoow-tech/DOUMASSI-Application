// Écran Splash applicatif (premier écran après le boot natif).
// Ticket E1-17 — warmup Sprint 0.
// Affiche "DOUMASSI" en vert néon pendant 1s, fade-out sur 1s, puis redirige vers login.

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text, YStack } from 'tamagui';

import { t } from '@/i18n';

export default function Splash() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Attend 1s d'affichage, puis lance le fade-out sur 1s (total ≈ 2s)
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        router.replace('/(auth)/login');
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [opacity]);

  return (
    <Animated.View style={{ flex: 1, opacity }}>
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Text
          fontSize={56}
          fontWeight="700"
          color="$accentNeon"
          letterSpacing={4}
          fontFamily="$body"
        >
          {t.splash.tagline}
        </Text>
      </YStack>
    </Animated.View>
  );
}
