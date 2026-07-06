// useAuthorReputation — E9-15 (#275)
//
// Réputation dérivée d'un auteur (get_author_reputation). Sert à afficher un
// badge de palier sur la carte auteur. staleTime long : la réputation bouge
// lentement.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type ReputationTier = 'expert' | 'confirme' | 'contributeur' | 'none';

export interface AuthorReputation {
  resource_count: number;
  bookmarks_received: number;
  tier: ReputationTier;
}

export const REPUTATION_LABEL: Record<Exclude<ReputationTier, 'none'>, string> = {
  expert: 'Expert',
  confirme: 'Contributeur confirmé',
  contributeur: 'Contributeur',
};

function isTier(v: unknown): v is ReputationTier {
  return v === 'expert' || v === 'confirme' || v === 'contributeur' || v === 'none';
}

export function useAuthorReputation(authorId: string | null) {
  return useQuery({
    queryKey: authorId ? ['cours', 'reputation', authorId] : ['cours', 'reputation', 'none'],
    enabled: Boolean(authorId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AuthorReputation | null> => {
      if (!authorId) return null;
      const { data, error } = await supabase.rpc('get_author_reputation', {
        p_author_id: authorId,
      });
      if (error) {
        logger.warn('get_author_reputation failed', { message: error.message, authorId });
        throw error;
      }
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        resource_count: typeof r.resource_count === 'number' ? r.resource_count : 0,
        bookmarks_received: typeof r.bookmarks_received === 'number' ? r.bookmarks_received : 0,
        tier: isTier(r.tier) ? r.tier : 'none',
      };
    },
  });
}
