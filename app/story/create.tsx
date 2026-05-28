// Route Expo Router — Créer une story (E4-12).
// Modale full-screen ; le composant vit dans src/features/stories/screens/.

import { Stack } from 'expo-router';

import { CreateStoryScreen } from '@/features/stories/screens/CreateStoryScreen';

export default function CreateStoryRoute() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal' }} />
      <CreateStoryScreen />
    </>
  );
}
