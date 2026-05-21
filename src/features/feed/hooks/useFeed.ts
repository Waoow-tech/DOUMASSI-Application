import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

type FeedRpcRow = PostCardPost & {
  media_type: 'text' | 'image' | 'video' | string;
};

function mapFeedPost(row: FeedRpcRow): PostCardPost {
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
    bookmarked_by_me: row.bookmarked_by_me ?? false,
  };
}

async function fetchFeedPage(cursor: string | null) {
  const { data, error } = await supabase.rpc('get_feed', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    logger.warn('get_feed foryou failed', { message: error.message });
    throw error;
  }

  const posts = ((data ?? []) as FeedRpcRow[]).map(mapFeedPost);
  const nextCursor =
    posts.length === PAGE_SIZE ? (posts[posts.length - 1]?.created_at ?? null) : null;

  return { posts, nextCursor };
}

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed', 'social', 'foryou'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useToggleFeedLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc('toggle_like', { p_post_id: postId });
      if (error) throw error;
      return { postId, liked: Boolean(data) };
    },
    onMutate: async (postId) => {
      const queryKey = ['feed', 'social', 'foryou'];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData<ReturnType<typeof useFeed>['data']>(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    liked_by_me: !post.liked_by_me,
                    like_count: post.liked_by_me
                      ? Math.max(0, post.like_count - 1)
                      : post.like_count + 1,
                  }
                : post
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (error, _postId, context) => {
      logger.warn('toggle_like failed', { message: error.message });
      if (context?.previous) {
        queryClient.setQueryData(['feed', 'social', 'foryou'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed', 'social', 'foryou'] });
    },
  });
}

export function useToggleFeedBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc('toggle_bookmark', { p_post_id: postId });
      if (error) throw error;
      return { postId, bookmarked: Boolean(data) };
    },
    onMutate: async (postId) => {
      const queryKey = ['feed', 'social', 'foryou'];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData<ReturnType<typeof useFeed>['data']>(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    bookmarked_by_me: !post.bookmarked_by_me,
                    bookmark_count: post.bookmarked_by_me
                      ? Math.max(0, post.bookmark_count - 1)
                      : post.bookmark_count + 1,
                  }
                : post
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (error, _postId, context) => {
      logger.warn('toggle_bookmark failed', { message: error.message });
      if (context?.previous) {
        queryClient.setQueryData(['feed', 'social', 'foryou'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed', 'social', 'foryou'] });
      // E4-07 : un un-bookmark depuis le feed (ou l'écran /bookmarks lui-même)
      // doit aussi rafraîchir la liste des sauvegardés.
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}
