// useMatchingCandidates — E13-06
//
// Découverte des personnes dont l'intention correspond à la mienne.
//
// ⚠️ Passe OBLIGATOIREMENT par la RPC `get_matching_candidates` (E13-04) : c'est
// elle qui applique l'opt-in réciproque, la segmentation par âge et les blocages
// bilatéraux. Un SELECT direct sur `matching_intents` ne renverrait de toute
// façon que mes propres lignes (RLS, E13-03).

import { useInfiniteQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { MatchingDirection, MatchingDomain } from './useMatchingIntents';

const PAGE_SIZE = 20;

export interface MatchingCandidate {
  intent_id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  domain: MatchingDomain;
  direction: MatchingDirection;
  subject_code: string | null;
  level_code: string | null;
  tags: string[] | null;
  note: string | null;
  created_at: string;
}

export interface MatchingSearchParams {
  domain: MatchingDomain;
  subjectCode?: string | null;
  levelCode?: string | null;
  tags?: string[] | null;
  /** null = « cherche » ET « propose » (comportement voulu par défaut). */
  direction?: MatchingDirection | null;
}

interface CandidatesPage {
  candidates: MatchingCandidate[];
  nextCursor: string | null;
}

function toCandidate(row: Record<string, unknown>): MatchingCandidate {
  return {
    intent_id: String(row.intent_id ?? ''),
    user_id: String(row.user_id ?? ''),
    username: String(row.username ?? ''),
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    is_verified: Boolean(row.is_verified ?? false),
    domain: (row.domain as MatchingDomain) ?? 'scolaire',
    direction: (row.direction as MatchingDirection) ?? 'cherche',
    subject_code: (row.subject_code as string | null) ?? null,
    level_code: (row.level_code as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    note: (row.note as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export function matchingCandidatesQueryKey(params: MatchingSearchParams | null) {
  return [
    'matching',
    'candidates',
    params
      ? {
          domain: params.domain,
          subject: params.subjectCode ?? null,
          level: params.levelCode ?? null,
          tags: params.tags ?? null,
          direction: params.direction ?? null,
        }
      : null,
  ] as const;
}

export function useMatchingCandidates(params: MatchingSearchParams | null) {
  return useInfiniteQuery<CandidatesPage>({
    queryKey: matchingCandidatesQueryKey(params),
    enabled: params !== null,
    initialPageParam: null,
    queryFn: async ({ pageParam }): Promise<CandidatesPage> => {
      if (!params) return { candidates: [], nextCursor: null };

      const { data, error } = await supabase.rpc('get_matching_candidates', {
        p_domain: params.domain,
        p_subject_code: params.subjectCode ?? null,
        p_level_code: params.levelCode ?? null,
        p_tags: params.tags ?? null,
        p_direction: params.direction ?? null,
        p_limit: PAGE_SIZE,
        p_cursor: typeof pageParam === 'string' ? pageParam : null,
      });

      if (error) {
        // Les refus de garde-fou (opt-in, date de naissance) remontent ici :
        // l'écran les traduit via mapMatchingError.
        logger.warn('get_matching_candidates failed', { message: error.message });
        throw error;
      }

      const candidates = ((data ?? []) as Record<string, unknown>[]).map(toCandidate);
      const last = candidates[candidates.length - 1];

      return {
        candidates,
        nextCursor: candidates.length === PAGE_SIZE ? (last?.created_at ?? null) : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}
