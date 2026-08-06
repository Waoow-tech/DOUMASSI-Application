// useReportProfile — Sécu B2.
//
// Signalement d'un profil via la RPC `report_profile` (security definer).
// Les motifs doivent rester alignés avec le CHECK de la migration
// 20260730120000_profile_reports.sql.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export const PROFILE_REPORT_REASONS = [
  'inapproprie',
  'harcelement',
  'spam',
  'faux_profil',
  'autre',
] as const;

export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number];

export function useReportProfile() {
  return useMutation<void, Error, { userId: string; reason: ProfileReportReason }>({
    mutationFn: async ({ userId, reason }) => {
      const { error } = await supabase.rpc('report_profile', {
        p_reported_user_id: userId,
        p_reason: reason,
      });
      if (error) {
        logger.warn('report_profile failed', { message: error.message });
        throw error;
      }
    },
  });
}
