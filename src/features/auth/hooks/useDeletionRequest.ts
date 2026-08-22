// Hook gestion de la demande de suppression de compte — E3-12.
// - useDeletionRequest() : lit la demande en cours (si elle existe)
// - requestDeletion(reason) : INSERT dans deletion_requests
// - cancelDeletion() : UPDATE cancelled_at = now()

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const deletionRequestQueryKey = ['account', 'deletion-request'] as const;

export interface DeletionRequestRow {
  user_id: string;
  requested_at: string;
  reason: string | null;
  scheduled_delete_at: string;
  cancelled_at: string | null;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id ?? null;
}

/**
 * Récupère la demande de suppression active (cancelled_at IS NULL,
 * processed_at IS NULL) pour l'user courant, si elle existe.
 *
 * Le filtre `processed_at IS NULL` est important : depuis E8-08, un job
 * cron quotidien marque les demandes traitées avec un timestamp dans cette
 * colonne. Une row processed correspond à un compte déjà anonymisé — l'user
 * concerné ne peut plus se reconnecter (ban_until), mais par défense en
 * profondeur on filtre quand même côté lecture.
 */
export function useDeletionRequest() {
  return useQuery({
    queryKey: deletionRequestQueryKey,
    queryFn: async (): Promise<DeletionRequestRow | null> => {
      const userId = await getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('deletion_requests')
        .select('user_id, requested_at, reason, scheduled_delete_at, cancelled_at')
        .eq('user_id', userId)
        .is('cancelled_at', null)
        .is('processed_at', null)
        .maybeSingle();

      if (error) {
        logger.warn('Deletion request query failed', { message: error.message });
        throw error;
      }

      return (data as DeletionRequestRow | null) ?? null;
    },
    staleTime: 60_000,
  });
}

/**
 * Mutation : crée une demande de suppression du compte courant.
 * `reason` est optionnel (commentaire libre de l'user pour analyse interne).
 */
export function useRequestDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason: string | null) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('deletion_requests')
        .insert({ user_id: userId, reason });

      if (error) throw error;

      logger.info('Account deletion requested', {
        userId,
        hasReason: Boolean(reason && reason.trim()),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deletionRequestQueryKey });
    },
  });
}

/**
 * Mutation : annule la demande de suppression active de l'user courant
 * (UPDATE cancelled_at = now()).
 */
export function useCancelDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('deletion_requests')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('cancelled_at', null)
        .is('processed_at', null);

      if (error) throw error;

      logger.info('Account deletion cancelled', { userId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deletionRequestQueryKey });
    },
  });
}
