// Écran Splash applicatif (premier écran après le boot natif).
// Affiche "DOUMASSI" 1s, fade-out 1s, puis redirige selon useAuthGuard :
//   - unauthenticated → /welcome
//   - incomplete      → /onboarding
//   - complete        → /feed
// Garde le splash visible tant que l'auth est en cours pour éviter les flashs.
//
// Ticket E1-17 (splash) + E2-07 (guard logic).

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text, YStack } from 'tamagui';

import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { t } from '@/i18n';

export default function Splash() {
  const opacity = useRef(new Animated.Value(1)).current;
  const status = useAuthGuard();
  const minDisplayElapsed = useRef(false);

  useEffect(() => {
    // Affiche le splash au moins 1s pour ne pas qu'il "flashe".
    const timer = setTimeout(() => {
      minDisplayElapsed.current = true;
      maybeRedirect();
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // À chaque changement de status, tente de rediriger
  // (uniquement après le délai minimum + une fois le check terminé).
  useEffect(() => {
    maybeRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const maybeRedirect = () => {
    if (!minDisplayElapsed.current) return;
    if (status === 'loading') return;

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
          router.replace('/(onboarding)');
          break;
        case 'complete':
          router.replace('/feed');
          break;
      }
    });
  };

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
