// Hook block/unblock — E3-09.
// Gère :
// - block(userId) : INSERT dans la table blocks
// - unblock(userId) : DELETE de la row blocks
// - Invalidation du cache TanStack après block/unblock
// - (Bonus) Log PostHog user_blocked
//
// L'ancienne logique inline dans [id]/index.tsx est remplacée
// par ce hook pour centraliser la mutation.

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface UseBlockReturn {
  block: () => Promise<void>;
  unblock: () => Promise<void>;
  isPending: boolean;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new Error('No authenticated user');
  }
  return data.session.user.id;
}

/**
 * Hook de modération : bloquer / débloquer un user.
 *
 * Après un block réussi :
 * - Invalide les caches profil, counters, posts et feed
 * - Invalide la relation follow (l'user bloqué disparaît)
 *
 * @param targetUserId UUID de l'user cible (ou null)
 * @param onSuccess callback optionnel après block réussi
 *   (ex: afficher toast, rediriger)
 */
export function useBlock(targetUserId: string | null, onSuccess?: () => void): UseBlockReturn {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  // Invalide toutes les queries liées à l'user bloqué
  const invalidateBlockedUserCache = useCallback(
    (blockedId: string) => {
      // Profil, counters, posts de l'user bloqué
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', blockedId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', blockedId, 'counters'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', blockedId, 'posts'],
      });
      // Relation follow avec l'user bloqué
      void queryClient.invalidateQueries({
        queryKey: ['follow-relation', blockedId],
      });
      // Feed (pour cacher les posts du bloqué)
      void queryClient.invalidateQueries({
        queryKey: ['feed'],
        exact: false,
      });
    },
    [queryClient]
  );

  const block = useCallback(async () => {
    if (!targetUserId) return;
    setIsPending(true);

    try {
      const currentUserId = await getCurrentUserId();

      const { error } = await supabase.from('blocks').insert({
        blocker_id: currentUserId,
        blocked_id: targetUserId,
      });

      if (error) throw error;

      // Invalider le cache
      invalidateBlockedUserCache(targetUserId);

      // (Bonus) Log pour monitoring
      logger.info('user_blocked', {
        blocked_id: targetUserId,
      });

      onSuccess?.();
    } catch (err) {
      logger.warn('Block failed', {
        message: (err as Error).message,
      });
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [targetUserId, invalidateBlockedUserCache, onSuccess]);

  const unblock = useCallback(async () => {
    if (!targetUserId) return;
    setIsPending(true);

    try {
      const currentUserId = await getCurrentUserId();

      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetUserId);

      if (error) throw error;

      // Invalider le cache (les données redeviennent visibles)
      invalidateBlockedUserCache(targetUserId);
    } catch (err) {
      logger.warn('Unblock failed', {
        message: (err as Error).message,
      });
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [targetUserId, invalidateBlockedUserCache]);

  return { block, unblock, isPending };
}
