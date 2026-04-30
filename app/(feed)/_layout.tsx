// Layout du groupe (feed) — écrans authentifiés (post-login).
// Pour l'instant juste feed, mais ce groupe accueillera profile, search, etc.
// Ticket E2-03 — Sprint 1 Auth & Onboarding.

import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
