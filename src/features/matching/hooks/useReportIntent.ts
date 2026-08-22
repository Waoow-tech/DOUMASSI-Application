// useReportIntent — E13-07
//
// Signalement d'une intention de mise en relation.
// La RPC `report_matching_intent` (security definer) enregistre le signalement
// et désactive automatiquement l'intention au seuil configuré (app_config).
//
// Les motifs doivent rester alignés avec le CHECK de la migration.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const MATCHING_REPORT_REASONS = ['inapproprie', 'spam', 'faux_profil', 'autre'] as const;

export type MatchingReportReason = (typeof MATCHING_REPORT_REASONS)[number];

export function useReportIntent() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { intentId: string; reason: MatchingReportReason }>({
    mutationFn: async ({ intentId, reason }) => {
      const { error } = await supabase.rpc('report_matching_intent', {
        p_intent_id: intentId,
        p_reason: reason,
      });
      if (error) {
        logger.warn('report_matching_intent failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      // L'intention a pu être désactivée (seuil atteint) → on rafraîchit la liste.
      void queryClient.invalidateQueries({ queryKey: ['matching', 'candidates'] });
    },
  });
}
