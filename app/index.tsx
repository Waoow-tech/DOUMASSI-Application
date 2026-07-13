// Écran Splash applicatif (premier écran après le boot natif).
// Affiche "DOUMASSI" 1s, fade-out 600ms, puis redirige selon useAuthGuard :
//   - unauthenticated → /welcome
//   - incomplete      → /onboarding
//   - complete        → /feed
// Garde le splash visible tant que (1) le délai min n'est pas écoulé ET
// (2) l'auth est en cours de check, pour éviter les flashs.
//
// Ticket E1-17 (splash) + E2-07 (guard logic).

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Text, YStack } from 'tamagui';

import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { useTranslations } from '@/i18n';

export default function Splash() {
  const t = useTranslations();
  const opacity = useRef(new Animated.Value(1)).current;
  const status = useAuthGuard();
  const [minElapsed, setMinElapsed] = useState(false);
  const hasRedirected = useRef(false);

  // Délai minimum d'affichage (état pour déclencher le useEffect de redirect)
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Redirect dès que les 2 conditions sont remplies (1) délai écoulé (2) status connu
  useEffect(() => {
    if (!minElapsed || status === 'loading') return;
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      switch (status) {
        case 'unauthenticated':
          router.replace('/(auth)/welcome');
          break;
        case 'incomplete':
        case 'onboarding':
          router.replace('/(onboarding)');
          break;
        case 'incomplete-google':
          router.replace('/(onboarding)/complete-account');
          break;
        case 'complete':
          router.replace('/feed');
          break;
      }
    });
  }, [minElapsed, status, opacity]);

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
