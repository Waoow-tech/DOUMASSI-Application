// Écran Splash applicatif (premier écran après le boot natif).
// Ticket E1-17 — warmup Sprint 0.
// Sprint 1 : redirection conditionnelle (auth check) sera ajoutée par les stagiaires.

import { Text, YStack } from 'tamagui';

import { t } from '@/i18n';

export default function Splash() {
  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
      <Text fontSize={56} fontWeight="700" color="$accentNeon" letterSpacing={4} fontFamily="$body">
        {t.splash.tagline}
      </Text>
    </YStack>
  );
}
