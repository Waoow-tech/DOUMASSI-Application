// Route Expo Router — Visionneuse de stories (E4-13).
// Modale plein écran (sans TabBar, sans header) ; le composant vit dans
// src/features/stories/screens/.

import { Stack } from 'expo-router';

import { StoryViewerScreen } from '@/features/stories/screens/StoryViewerScreen';

export default function StoryViewerRoute() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal' }} />
      <StoryViewerScreen />
    </>
  );
}
