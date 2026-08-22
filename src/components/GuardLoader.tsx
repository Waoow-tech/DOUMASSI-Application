// Loader minimaliste affiché pendant que useAuthGuard vérifie la session.
// Volontairement simple (pas d'animation, pas de spinner) : matche le fond noir
// du splash pour qu'il y ait zéro flash visible quand on transite splash → guard → écran.
//
// Ticket E2-07 — Sprint 1 Auth & Onboarding.

import { YStack } from 'tamagui';

export default function GuardLoader() {
  return <YStack flex={1} backgroundColor="$background" />;
}
