// Route Expo Router — Écran de conversation (E6-03 + E6-05).
// Modale fullscreen sans tabbar. Le composant vit dans
// src/features/messaging/screens/.

import { Stack } from 'expo-router';

import { ConversationScreen } from '@/features/messaging/screens/ConversationScreen';

export default function ConversationRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
      <ConversationScreen />
    </>
  );
}
