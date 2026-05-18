// Stack interne du tab Profile.
// Permet de push edit / followers / following / [id] sans quitter l'onglet.

import { Stack } from 'expo-router';

export default function ProfileTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    />
  );
}
