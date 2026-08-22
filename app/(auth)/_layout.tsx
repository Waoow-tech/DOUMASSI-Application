// Layout du groupe (auth) — écrans publics (login, signup, forgot password).
// headerShown: false pour un rendu full-screen immersif.
// Ticket E2-01 — Sprint 1 Auth & Onboarding.

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        animation: 'fade',
      }}
    />
  );
}
