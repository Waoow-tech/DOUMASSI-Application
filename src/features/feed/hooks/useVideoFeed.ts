// useVideoFeed — E14-02.
//
// Fil des posts vidéo, pour le défilement vertical plein écran ouvert depuis
// le feed social. S'appuie sur la RPC `get_video_feed` (E14-02), qui applique
// exactement les mêmes règles de visibilité que `get_feed`.
//
// Le curseur de départ est celui de la vidéo tapée : on continue donc la
// navigation à partir d'elle, vers les vidéos plus anciennes. C'est le
// comportement attendu quand on ouvre une vidéo depuis un fil — repartir des
// plus récentes désorienterait (« pourquoi ce n'est pas la suivante ? »).

import { useInfiniteQuery } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { useHiddenPosts } from './useHiddenPosts';

const PAGE_SIZE = 20;

type VideoFeedRow = PostCardPost & {
  media_type: 'text' | 'image' | 'video' | string;
};

function mapVideoPost(row: VideoFeedRow): PostCardPost {
  return {
    id: row.id,
    author_id: row.author_id,
    author_username: row.author_username,
    author_full_name: row.author_full_name,
    author_avatar_url: row.author_avatar_url,
    author_is_verified: row.author_is_verified,
    content: row.content ?? '',
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : [],
    media_type: 'video',
    created_at: row.created_at,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    share_count: row.share_count ?? 0,
    bookmark_count: row.bookmark_count ?? 0,
    liked_by_me: row.liked_by_me ?? false,
    bookmarked_by_me: row.bookmarked_by_me ?? false,
  };
}

async function fetchVideoPage(cursor: string | null) {
  const { data, error } = await supabase.rpc('get_video_feed', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    logger.warn('get_video_feed failed', { message: error.message });
    throw error;
  }

  const posts = ((data ?? []) as VideoFeedRow[]).map(mapVideoPost);
  const nextCursor =
    posts.length === PAGE_SIZE ? (posts[posts.length - 1]?.created_at ?? null) : null;

  return { posts, nextCursor };
}

/**
 * @param startCursor `created_at` de la vidéo d'entrée. Les pages ramenées
 *   sont STRICTEMENT plus anciennes — la vidéo d'entrée elle-même est ajoutée
 *   en tête par l'écran, ce qui évite tout doublon sans dédoublonnage.
 */
export function useVideoFeed(startCursor: string | null | undefined) {
  const hiddenPostsQuery = useHiddenPosts();
  const hiddenIds = hiddenPostsQuery.data ?? [];

  return useInfiniteQuery({
    queryKey: ['feed', 'video', startCursor ?? 'top'],
    enabled: startCursor !== undefined,
    queryFn: ({ pageParam }) => fetchVideoPage(pageParam),
    initialPageParam: (startCursor ?? null) as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: page.posts.filter((post) => !hiddenIds.includes(post.id)),
      })),
    }),
  });
}
