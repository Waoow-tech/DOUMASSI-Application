import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { useHiddenPosts } from './useHiddenPosts';

const PAGE_SIZE = 20;

type FeedRpcRow = PostCardPost & {
  media_type: 'text' | 'image' | 'video' | string;
};

type FeedQueryData = {
  pages: { posts: PostCardPost[]; nextCursor: string | null }[];
  pageParams: unknown[];
};

export const FEED_QUERY_KEY = ['feed', 'social', 'foryou'] as const;

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

function updateFeedPost(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  updater: (post: PostCardPost) => PostCardPost
) {
  queryClient.setQueryData<FeedQueryData>(FEED_QUERY_KEY, (old) => {
    if (!old) return old;

    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        posts: page.posts.map((post) => (post.id === postId ? updater(post) : post)),
      })),
    };
  });
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
  const hiddenPostsQuery = useHiddenPosts();
  const hiddenIds = hiddenPostsQuery.data ?? [];

  return useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: null as string | null,
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

export function usePostDetail(postId: string | undefined) {
  return useQuery({
    queryKey: ['post', postId],
    enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_post_with_counts', {
        p_post_id: postId,
      });

      if (error) {
        logger.warn('get_post_with_counts failed', { message: error.message, postId });
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return mapFeedPost(row as FeedRpcRow);
    },
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
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previous = queryClient.getQueryData(FEED_QUERY_KEY);

      updateFeedPost(queryClient, postId, (post) => ({
        ...post,
        liked_by_me: !post.liked_by_me,
        like_count: post.liked_by_me ? Math.max(0, post.like_count - 1) : post.like_count + 1,
      }));

      return { previous };
    },
    onError: (error, _postId, context) => {
      logger.warn('toggle_like failed', { message: error.message });
      if (context?.previous) {
        queryClient.setQueryData(FEED_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
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
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previous = queryClient.getQueryData(FEED_QUERY_KEY);

      updateFeedPost(queryClient, postId, (post) => ({
        ...post,
        bookmarked_by_me: !post.bookmarked_by_me,
        bookmark_count: post.bookmarked_by_me
          ? Math.max(0, post.bookmark_count - 1)
          : post.bookmark_count + 1,
      }));

      return { previous };
    },
    onError: (error, _postId, context) => {
      logger.warn('toggle_bookmark failed', { message: error.message });
      if (context?.previous) {
        queryClient.setQueryData(FEED_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
      // E4-07 : un un-bookmark depuis le feed (ou l'écran /bookmarks lui-même)
      // doit aussi rafraîchir la liste des sauvegardés.
      void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

export function useTogglePostLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('toggle_like', { p_post_id: postId });
      if (error) throw error;
      return Boolean(data);
    },
    onMutate: async () => {
      const queryKey = ['post', postId];
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previousPost = queryClient.getQueryData<PostCardPost | null>(queryKey);
      const previousFeed = queryClient.getQueryData(FEED_QUERY_KEY);

      const updater = (post: PostCardPost) => ({
        ...post,
        liked_by_me: !post.liked_by_me,
        like_count: post.liked_by_me ? Math.max(0, post.like_count - 1) : post.like_count + 1,
      });

      queryClient.setQueryData<PostCardPost | null>(queryKey, (old) => (old ? updater(old) : old));
      updateFeedPost(queryClient, postId, updater);

      return { previousPost, previousFeed };
    },
    onError: (error, _variables, context) => {
      logger.warn('toggle_like detail failed', { message: error.message, postId });
      queryClient.setQueryData(['post', postId], context?.previousPost);
      queryClient.setQueryData(FEED_QUERY_KEY, context?.previousFeed);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}

export function useTogglePostBookmark(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('toggle_bookmark', { p_post_id: postId });
      if (error) throw error;
      return Boolean(data);
    },
    onMutate: async () => {
      const queryKey = ['post', postId];
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previousPost = queryClient.getQueryData<PostCardPost | null>(queryKey);
      const previousFeed = queryClient.getQueryData(FEED_QUERY_KEY);

      const updater = (post: PostCardPost) => ({
        ...post,
        bookmarked_by_me: !post.bookmarked_by_me,
        bookmark_count: post.bookmarked_by_me
          ? Math.max(0, post.bookmark_count - 1)
          : post.bookmark_count + 1,
      });

      queryClient.setQueryData<PostCardPost | null>(queryKey, (old) => (old ? updater(old) : old));
      updateFeedPost(queryClient, postId, updater);

      return { previousPost, previousFeed };
    },
    onError: (error, _variables, context) => {
      logger.warn('toggle_bookmark detail failed', { message: error.message, postId });
      queryClient.setQueryData(['post', postId], context?.previousPost);
      queryClient.setQueryData(FEED_QUERY_KEY, context?.previousFeed);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}

export function useIncrementPostShare(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('increment_share_count', { p_post_id: postId });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onMutate: async () => {
      const queryKey = ['post', postId];
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previousPost = queryClient.getQueryData<PostCardPost | null>(queryKey);
      const previousFeed = queryClient.getQueryData(FEED_QUERY_KEY);

      const updater = (post: PostCardPost) => ({
        ...post,
        share_count: post.share_count + 1,
      });

      queryClient.setQueryData<PostCardPost | null>(queryKey, (old) => (old ? updater(old) : old));
      updateFeedPost(queryClient, postId, updater);

      return { previousPost, previousFeed };
    },
    onError: (error, _variables, context) => {
      logger.warn('increment_share_count detail failed', { message: error.message, postId });
      queryClient.setQueryData(['post', postId], context?.previousPost);
      queryClient.setQueryData(FEED_QUERY_KEY, context?.previousFeed);
    },
    onSuccess: (shareCount) => {
      if (!shareCount) return;
      const updater = (post: PostCardPost) => ({ ...post, share_count: shareCount });
      queryClient.setQueryData<PostCardPost | null>(['post', postId], (old) =>
        old ? updater(old) : old
      );
      updateFeedPost(queryClient, postId, updater);
    },
  });
}
