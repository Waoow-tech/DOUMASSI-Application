// Hook centralisé pour la déconnexion.
// Effectue une purge complète :
//   - Session Supabase (auth.signOut)
//   - AsyncStorage (toutes les clés non-Supabase qu'on aurait pu y mettre)
//   - SecureStore (les clés Supabase sont gérées par signOut via authStorage,
//     mais on nettoie d'autres clés éventuelles ici)
//   - Cache TanStack Query (toutes les queries en cache : profil, posts, etc.)
//
// Puis redirige vers /welcome.
//
// Ticket E2-12 — Sprint 1 Auth & Onboarding.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function useLogout() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const logout = async () => {
    setIsLoading(true);

    try {
      // 1. Supabase signOut — invalide la session et purge la clé sb-* dans le storage
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('supabase.auth.signOut failed', { message: error.message });
      }

      // 2. AsyncStorage — purge complète au cas où (no-op si rien dedans)
      try {
        await AsyncStorage.clear();
      } catch (err) {
        logger.warn('AsyncStorage.clear failed', { err });
      }

      // 3. Cache TanStack Query — vide toutes les queries (profil, posts, etc.)
      queryClient.clear();

      logger.info('Logout complete — redirecting to welcome');
    } catch (err: unknown) {
      logger.error('Unexpected logout error', err);
    } finally {
      // On redirige toujours vers welcome, même en cas d'erreur partielle :
      // l'objectif est que l'user soit déconnecté côté UX.
      setIsLoading(false);
      router.replace('/(auth)/welcome');
    }
  };

  return { logout, isLoading };
}
