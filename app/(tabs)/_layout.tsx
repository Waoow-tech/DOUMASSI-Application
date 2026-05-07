// Layout du groupe (tabs) — écrans authentifiés avec onglets.
// Protégé par le même guard que (feed).
// Ticket E3-01 (création).

import { Redirect, Stack } from 'expo-router';

import GuardLoader from '@/components/GuardLoader';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';

export default function TabsLayout() {
  const status = useAuthGuard();

  if (status === 'loading') {
    return <GuardLoader />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (status === 'incomplete' || status === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
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
