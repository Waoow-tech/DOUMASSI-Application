// useReportResource — E9-08 (#268)
//
// Wrappe la RPC report_resource. Le calcul du seuil + le masquage auto sont
// entièrement côté DB (security definer). Le client se contente d'envoyer la
// raison.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type ReportReason = 'inapproprie' | 'fausse_info' | 'spam' | 'autre';

// Ordre d'affichage des raisons. Les libellés UI sont dans le dico i18n
// (`t.cours.reportReason[reason]`) — on ne garde ici que l'énumération.
export const REPORT_REASONS: readonly ReportReason[] = [
  'inapproprie',
  'fausse_info',
  'spam',
  'autre',
];

export function useReportResource() {
  return useMutation<void, Error, { resourceId: string; reason: ReportReason }>({
    mutationFn: async ({ resourceId, reason }) => {
      const { error } = await supabase.rpc('report_resource', {
        p_resource_id: resourceId,
        p_reason: reason,
      });
      if (error) {
        logger.warn('report_resource failed', { message: error.message, resourceId });
        throw error;
      }
    },
  });
}
