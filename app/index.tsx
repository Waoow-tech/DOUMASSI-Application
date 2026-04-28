// Écran Splash applicatif (premier écran après le boot natif).
// Ticket E1-17 — warmup Sprint 0.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, YStack } from 'tamagui';

import { t } from '@/i18n';

export default function Splash() {
  useEffect(() => {
    const timer = setTimeout(() => {
      // replace pour empêcher le retour au splash
      router.replace('/login');
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
      <Text fontSize={56} fontWeight="700" color="$accentNeon" letterSpacing={4} fontFamily="$body">
        {t.splash.tagline}
      </Text>
    </YStack>
  );
}
