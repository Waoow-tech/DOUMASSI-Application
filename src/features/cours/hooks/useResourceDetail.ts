// useResourceDetail — E9-05 (Fiche ressource)
//
// La RPC get_resource_detail incrémente le view_count à chaque appel côté DB.
// Comme pour la marketplace, on limite les refetch (staleTime 60s + pas de
// refetch au focus/mount) pour ne pas spammer le compteur.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ResourceType } from './useResources';

export interface ResourceDetail {
  id: string;
  author_id: string;
  author_username: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  level_code: string;
  subject_code: string;
  type: ResourceType;
  title: string;
  description: string | null;
  files: string[];
  status: string;
  view_count: number;
  created_at: string;
  bookmarked_by_me: boolean;
}

type RpcRow = Record<string, unknown>;

function isType(value: unknown): value is ResourceType {
  return (
    value === 'cours' || value === 'fiche_revision' || value === 'exercices' || value === 'annale'
  );
}

function mapDetail(row: RpcRow): ResourceDetail {
  return {
    id: String(row.id ?? ''),
    author_id: String(row.author_id ?? ''),
    author_username: String(row.author_username ?? ''),
    author_full_name: (row.author_full_name as string | null) ?? null,
    author_avatar_url: (row.author_avatar_url as string | null) ?? null,
    author_is_verified: Boolean(row.author_is_verified ?? false),
    level_code: String(row.level_code ?? ''),
    subject_code: String(row.subject_code ?? ''),
    type: isType(row.type) ? row.type : 'cours',
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    files: Array.isArray(row.files) ? (row.files as string[]) : [],
    status: String(row.status ?? 'active'),
    view_count: typeof row.view_count === 'number' ? row.view_count : 0,
    created_at: String(row.created_at ?? ''),
    bookmarked_by_me: Boolean(row.bookmarked_by_me ?? false),
  };
}

export function resourceDetailQueryKey(resourceId: string) {
  return ['cours', 'detail', resourceId] as const;
}

export function useResourceDetail(resourceId: string | null) {
  return useQuery({
    queryKey: resourceId ? resourceDetailQueryKey(resourceId) : ['cours', 'detail', 'none'],
    enabled: Boolean(resourceId),
    queryFn: async (): Promise<ResourceDetail | null> => {
      if (!resourceId) return null;
      const { data, error } = await supabase.rpc('get_resource_detail', {
        p_resource_id: resourceId,
      });
      if (error) {
        logger.warn('get_resource_detail failed', { message: error.message, resourceId });
        throw error;
      }
      const rows = (data ?? []) as RpcRow[];
      const first = rows[0];
      return first ? mapDetail(first) : null;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
