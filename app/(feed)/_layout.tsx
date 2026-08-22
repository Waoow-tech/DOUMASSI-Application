// Layout du groupe (feed) — écrans authentifiés (post-login).
// Bloque l'accès si :
//   - pas de session → redirect /welcome
//   - profil incomplet → redirect /onboarding
//
// Ticket E2-03 (création) + E2-07 (guard de session).

import { Redirect, Stack } from 'expo-router';

import GuardLoader from '@/components/GuardLoader';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';

export default function FeedLayout() {
  const status = useAuthGuard();

  // Pendant le check (cold start), on affiche un loader pour éviter le flash.
  if (status === 'loading') {
    return <GuardLoader />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (status === 'incomplete' || status === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  if (status === 'incomplete-google') {
    return <Redirect href="/(onboarding)/complete-account" />;
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
