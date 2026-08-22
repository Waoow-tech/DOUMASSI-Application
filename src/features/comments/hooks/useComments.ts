import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { FEED_QUERY_KEY } from '@/features/feed/hooks/useFeed';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  author_username: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
};

type FeedCacheData = {
  pages: { posts: PostCardPost[]; nextCursor: string | null }[];
  pageParams: unknown[];
};

type CreateCommentInput = {
  content: string;
  parentCommentId?: string | null;
};

type DeleteCommentContext = {
  previousComments: Comment[] | undefined;
  previousPost: PostCardPost | null | undefined;
  previousFeed: FeedCacheData | undefined;
};

type ToggleCommentLikeContext = {
  previousComments: Comment[] | undefined;
};

const COMMENTS_LIMIT = 50;

function commentsQueryKey(postId: string) {
  return ['comments', postId] as const;
}

function updateFeedPost(
  old: FeedCacheData | undefined,
  postId: string,
  updater: (post: PostCardPost) => PostCardPost
) {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      posts: page.posts.map((post) => (post.id === postId ? updater(post) : post)),
    })),
  };
}

function updatePostCommentCount(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  delta: number
) {
  const updater = (post: PostCardPost) => ({
    ...post,
    comment_count: Math.max(0, post.comment_count + delta),
  });

  queryClient.setQueryData<PostCardPost | null>(['post', postId], (old) =>
    old ? updater(old) : old
  );
  queryClient.setQueryData<FeedCacheData>(FEED_QUERY_KEY, (old) =>
    updateFeedPost(old, postId, updater)
  );
}

export function useComments(postId: string) {
  return useQuery({
    queryKey: commentsQueryKey(postId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_post_comments', {
        p_post_id: postId,
        p_limit: COMMENTS_LIMIT,
      });

      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    staleTime: 30_000,
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateCommentInput>({
    mutationFn: async ({ content, parentCommentId }) => {
      const { data, error } = await supabase.rpc('create_comment', {
        p_post_id: postId,
        p_content: content.trim(),
        p_parent_comment_id: parentCommentId ?? null,
      });

      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
    onError: (error) => {
      logger.warn('create_comment failed', { message: error.message, postId });
    },
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, DeleteCommentContext>({
    mutationFn: async (commentId) => {
      const { data, error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });
      if (error) throw error;
      if (data !== true) throw new Error('Comment not deleted');
    },
    onMutate: async (commentId) => {
      const queryKey = commentsQueryKey(postId);
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });

      const previousComments = queryClient.getQueryData<Comment[]>(queryKey);
      const previousPost = queryClient.getQueryData<PostCardPost | null>(['post', postId]);
      const previousFeed = queryClient.getQueryData<FeedCacheData>(FEED_QUERY_KEY);
      const removedCount =
        previousComments?.filter(
          (comment) => comment.id === commentId || comment.parent_comment_id === commentId
        ).length ?? 0;

      queryClient.setQueryData<Comment[]>(queryKey, (old) =>
        old?.filter(
          (comment) => comment.id !== commentId && comment.parent_comment_id !== commentId
        )
      );

      if (removedCount > 0) {
        updatePostCommentCount(queryClient, postId, -removedCount);
      }

      return { previousComments, previousPost, previousFeed };
    },
    onError: (error, _commentId, context) => {
      logger.warn('delete_comment failed', { message: error.message, postId });
      queryClient.setQueryData(commentsQueryKey(postId), context?.previousComments);
      queryClient.setQueryData(['post', postId], context?.previousPost);
      queryClient.setQueryData(FEED_QUERY_KEY, context?.previousFeed);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}

export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string, ToggleCommentLikeContext>({
    mutationFn: async (commentId) => {
      const { data, error } = await supabase.rpc('toggle_comment_like', {
        p_comment_id: commentId,
      });

      if (error) throw error;
      return Boolean(data);
    },
    onMutate: async (commentId) => {
      const queryKey = commentsQueryKey(postId);
      await queryClient.cancelQueries({ queryKey });
      const previousComments = queryClient.getQueryData<Comment[]>(queryKey);

      queryClient.setQueryData<Comment[]>(queryKey, (old) =>
        old?.map((comment) => {
          if (comment.id !== commentId) return comment;

          return {
            ...comment,
            liked_by_me: !comment.liked_by_me,
            like_count: comment.liked_by_me
              ? Math.max(0, comment.like_count - 1)
              : comment.like_count + 1,
          };
        })
      );

      return { previousComments };
    },
    onError: (error, _commentId, context) => {
      logger.warn('toggle_comment_like failed', { message: error.message, postId });
      queryClient.setQueryData(commentsQueryKey(postId), context?.previousComments);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    },
  });
}
