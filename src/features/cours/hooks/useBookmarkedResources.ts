// useBookmarkedResources — E9-07 (#267)
//
// useInfiniteQuery sur get_my_bookmarked_resources. queryKey
// ['cours','bookmarks'] = celle invalidée par useToggleResourceBookmark →
// un unbookmark depuis n'importe quel écran rafraîchit celui-ci.
// Cursor sur bookmarked_at (aligné au ORDER BY rb.created_at desc de la RPC).

import { useInfiniteQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ResourceListItem, ResourceType } from './useResources';

const PAGE_SIZE = 20;

type RpcRow = Record<string, unknown>;

function isType(value: unknown): value is ResourceType {
  return (
    value === 'cours' || value === 'fiche_revision' || value === 'exercices' || value === 'annale'
  );
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
    bookmarked_by_me: true,
  };
}

async function fetchBookmarksPage(cursor: string | null) {
  const { data, error } = await supabase.rpc('get_my_bookmarked_resources', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });
  if (error) {
    logger.warn('get_my_bookmarked_resources failed', { message: error.message });
    throw error;
  }
  const rows = (data ?? []) as RpcRow[];
  const resources = rows.map(mapRow);
  const lastBookmarkedAt = rows[rows.length - 1]?.bookmarked_at;
  const nextCursor =
    resources.length === PAGE_SIZE && typeof lastBookmarkedAt === 'string'
      ? lastBookmarkedAt
      : null;
  return { resources, nextCursor };
}

export function useBookmarkedResources() {
  return useInfiniteQuery({
    queryKey: ['cours', 'bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarksPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}
