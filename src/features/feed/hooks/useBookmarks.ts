// E4-07 — Liste paginée des posts bookmarkés par l'user courant.
// Mêmes choix que useFeed (cf. ./useFeed.ts) :
//   - cursor pagination via RPC get_bookmarks(p_cursor, p_limit)
//   - mapping RPC row → PostCardPost (on ignore location/view_count, non
//     affichés par PostCard)
//   - logger.warn sur échec (Sentry breadcrumb)
// Le cursor est `bookmarked_at` (= b.created_at), pas `created_at` du post.

import { useInfiniteQuery } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;
const STALE_TIME_MS = 30_000;

type BookmarksRpcRow = PostCardPost & {
  bookmarked_at: string;
  media_type: 'text' | 'image' | 'video' | string;
};

function mapBookmarkRow(row: BookmarksRpcRow): PostCardPost {
  return {
    id: row.id,
    author_id: row.author_id,
    author_username: row.author_username,
    author_full_name: row.author_full_name,
    author_avatar_url: row.author_avatar_url,
    author_is_verified: row.author_is_verified,
    content: row.content ?? '',
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : [],
    media_type:
      row.media_type === 'image' || row.media_type === 'video' || row.media_type === 'text'
        ? row.media_type
        : 'text',
    created_at: row.created_at,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    share_count: row.share_count ?? 0,
    bookmark_count: row.bookmark_count ?? 0,
    liked_by_me: row.liked_by_me ?? false,
    bookmarked_by_me: row.bookmarked_by_me ?? true,
  };
}

async function fetchBookmarksPage(cursor: string | null) {
  const { data, error } = await supabase.rpc('get_bookmarks', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    logger.warn('get_bookmarks failed', { message: error.message });
    throw error;
  }

  const rows = (data ?? []) as BookmarksRpcRow[];
  const posts = rows.map(mapBookmarkRow);
  const lastRow = rows[rows.length - 1];
  const nextCursor = posts.length === PAGE_SIZE && lastRow ? lastRow.bookmarked_at : null;

  return { posts, nextCursor };
}

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarksPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_MS,
  });
}
