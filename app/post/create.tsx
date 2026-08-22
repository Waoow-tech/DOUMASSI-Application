// Route Expo Router pour l'écran « Créer un post » (E4-03).
// Présentation modale full-screen ; le composant écran vit dans
// src/features/feed/screens/ (pattern projet : route fine + screen séparé).

import { Stack } from 'expo-router';

import { CreatePostScreen } from '@/features/feed/screens/CreatePostScreen';

export default function CreatePostRoute() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal' }} />
      <CreatePostScreen />
    </>
  );
}
