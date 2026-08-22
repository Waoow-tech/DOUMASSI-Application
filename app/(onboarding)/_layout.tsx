// Layout du groupe (onboarding) — étapes de complétion de profil.
// Bloque l'accès si :
//   - pas de session → redirect /welcome
//   - profil déjà complet → redirect /feed (évite de re-onboarder un user déjà setup)
//
// Sera rempli par les tickets E2-08 (pseudo), E2-09 (avatar), E2-10 (cover), E2-11 (intérêts).
// Ticket E2-07 — Sprint 1 Auth & Onboarding (squelette + guard).

import { Redirect, Stack } from 'expo-router';

import GuardLoader from '@/components/GuardLoader';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';

export default function OnboardingLayout() {
  const status = useAuthGuard();

  if (status === 'loading') {
    return <GuardLoader />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  // 'onboarding' status = user has username but needs profile setup — allow through.
  // 'complete' status = user has filled profile fields — redirect to feed.
  if (status === 'complete') {
    return <Redirect href="/feed" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
