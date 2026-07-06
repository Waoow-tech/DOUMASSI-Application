// useCoursFollows — E9-14 (#274)
//
// Suivis matière/niveau + fil dédié.
//   - useMyCoursFollows : mes suivis (Set de "kind:code")
//   - useToggleCoursFollow : suit/ne suit plus (optimistic)
//   - useFollowedResources : fil paginé des ressources suivies

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ResourceListItem, ResourceType } from './useResources';

export type FollowKind = 'subject' | 'level';

export function followKey(kind: FollowKind, code: string) {
  return `${kind}:${code}`;
}

const MY_FOLLOWS_KEY = ['cours', 'follows', 'mine'] as const;

export function useMyCoursFollows() {
  return useQuery({
    queryKey: MY_FOLLOWS_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('get_my_cours_follows');
      if (error) {
        logger.warn('get_my_cours_follows failed', { message: error.message });
        throw error;
      }
      const set = new Set<string>();
      ((data ?? []) as { kind: string; code: string }[]).forEach((f) =>
        set.add(followKey(f.kind as FollowKind, f.code))
      );
      return set;
    },
  });
}

export function useToggleCoursFollow() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, { kind: FollowKind; code: string }>({
    mutationFn: async ({ kind, code }) => {
      const { data, error } = await supabase.rpc('toggle_cours_follow', {
        p_kind: kind,
        p_code: code,
      });
      if (error) {
        logger.warn('toggle_cours_follow failed', { message: error.message });
        throw error;
      }
      return Boolean(data);
    },
    onMutate: async ({ kind, code }) => {
      await queryClient.cancelQueries({ queryKey: MY_FOLLOWS_KEY });
      const key = followKey(kind, code);
      queryClient.setQueryData<Set<string>>(MY_FOLLOWS_KEY, (old) => {
        const next = new Set(old ?? []);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    onError: (_e, { kind, code }) => {
      const key = followKey(kind, code);
      queryClient.setQueryData<Set<string>>(MY_FOLLOWS_KEY, (old) => {
        const next = new Set(old ?? []);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['cours', 'followedResources'] });
    },
  });
}

const PAGE_SIZE = 20;
type RpcRow = Record<string, unknown>;

function isType(v: unknown): v is ResourceType {
  return v === 'cours' || v === 'fiche_revision' || v === 'exercices' || v === 'annale';
}

function mapRow(row: RpcRow): ResourceListItem {
  return {
    id: String(row.id ?? ''),
    author_id: String(row.author_id ?? ''),
    author_username: String(row.author_username ?? ''),
    author_avatar_url: (row.author_avatar_url as string | null) ?? null,
    author_is_verified: Boolean(row.author_is_verified ?? false),
    level_code: String(row.level_code ?? ''),
    subject_code: String(row.subject_code ?? ''),
    type: isType(row.type) ? row.type : 'cours',
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    files: Array.isArray(row.files) ? (row.files as string[]) : [],
    view_count: typeof row.view_count === 'number' ? row.view_count : 0,
    created_at: String(row.created_at ?? ''),
    bookmarked_by_me: Boolean(row.bookmarked_by_me ?? false),
  };
}

async function fetchFollowedPage(
  cursor: string | null
): Promise<{ resources: ResourceListItem[]; nextCursor: string | null }> {
  const { data, error } = await supabase.rpc('get_followed_resources', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });
  if (error) {
    logger.warn('get_followed_resources failed', { message: error.message });
    throw error;
  }
  const resources = ((data ?? []) as RpcRow[]).map(mapRow);
  const nextCursor =
    resources.length === PAGE_SIZE ? (resources[resources.length - 1]?.created_at ?? null) : null;
  return { resources, nextCursor };
}

export function useFollowedResources() {
  return useInfiniteQuery({
    queryKey: ['cours', 'followedResources'],
    queryFn: ({ pageParam }) => fetchFollowedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}
