// useMatchingIntents — E13-05
//
// Gestion de SES PROPRES intentions de mise en relation + de l'opt-in.
// Voir ADR-008.
//
// Lecture/écriture en accès direct : la RLS (E13-03) restreint déjà tout à
// `user_id = auth.uid()`. La découverte des intentions D'AUTRUI, elle, passe
// obligatoirement par la RPC `get_matching_candidates` (E13-06) — jamais par un
// SELECT direct, sinon on contournerait la segmentation d'âge et les blocages.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/profile/hooks/useProfile';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type MatchingDomain = 'scolaire' | 'business';
export type MatchingDirection = 'cherche' | 'propose';

export interface MatchingIntent {
  id: string;
  domain: MatchingDomain;
  direction: MatchingDirection;
  subject_code: string | null;
  level_code: string | null;
  tags: string[] | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export const myIntentsQueryKey = ['matching', 'my-intents'] as const;

function toIntent(row: Record<string, unknown>): MatchingIntent {
  return {
    id: String(row.id ?? ''),
    domain: (row.domain as MatchingDomain) ?? 'scolaire',
    direction: (row.direction as MatchingDirection) ?? 'cherche',
    subject_code: (row.subject_code as string | null) ?? null,
    level_code: (row.level_code as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    note: (row.note as string | null) ?? null,
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at ?? ''),
  };
}

/** Mes intentions (la RLS ne renvoie que les miennes). */
export function useMyIntents() {
  return useQuery({
    queryKey: myIntentsQueryKey,
    queryFn: async (): Promise<MatchingIntent[]> => {
      const { data, error } = await supabase
        .from('matching_intents')
        .select(
          'id, domain, direction, subject_code, level_code, tags, note, is_active, created_at'
        )
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('my intents fetch failed', { message: error.message });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(toIntent);
    },
    staleTime: 30_000,
  });
}

export interface CreateIntentVariables {
  domain: MatchingDomain;
  direction: MatchingDirection;
  /** Requis si domain = 'scolaire'. */
  subjectCode?: string | null;
  /** null = tous niveaux. */
  levelCode?: string | null;
  /** Requis si domain = 'business' (au moins 1). */
  tags?: string[] | null;
  note?: string | null;
}

export function useCreateIntent() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreateIntentVariables>({
    mutationFn: async (vars) => {
      // user_id est forcé par la RLS (with check user_id = auth.uid()), mais on
      // doit le fournir explicitement à l'insert.
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('matching_intents').insert({
        user_id: userId,
        domain: vars.domain,
        direction: vars.direction,
        subject_code: vars.domain === 'scolaire' ? (vars.subjectCode ?? null) : null,
        level_code: vars.domain === 'scolaire' ? (vars.levelCode ?? null) : null,
        tags: vars.domain === 'business' ? (vars.tags ?? null) : null,
        note: vars.note?.trim() ? vars.note.trim() : null,
      });

      if (error) {
        logger.warn('create intent failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myIntentsQueryKey });
    },
  });
}

export function useDeleteIntent() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { intentId: string }>({
    mutationFn: async ({ intentId }) => {
      const { error } = await supabase.from('matching_intents').delete().eq('id', intentId);
      if (error) {
        logger.warn('delete intent failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myIntentsQueryKey });
    },
  });
}

/**
 * Opt-in : apparaître (ou non) dans la mise en relation.
 * `false` par défaut en base — personne n'est visible sans l'avoir demandé.
 */
export function useMatchingOptIn() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { optIn: boolean }>({
    mutationFn: async ({ optIn }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ matching_opt_in: optIn, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        logger.warn('matching opt-in update failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
