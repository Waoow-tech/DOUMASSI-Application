import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { PostCardPost } from '@/components/feed/PostCard';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

type FeedCacheData = {
  pages: { posts: PostCardPost[]; nextCursor: string | null }[];
  pageParams: unknown[];
};

type ProfilePostItem = {
  id: string;
  [key: string]: unknown;
};

type DeletePostContext = {
  previousFeeds: [readonly unknown[], unknown][];
  previousProfilePosts: [readonly unknown[], unknown][];
  previousPost: unknown;
};

function removePostFromFeedCache(old: FeedCacheData | undefined, postId: string) {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => post.id !== postId),
    })),
  };
}

function removePostFromProfilePostsCache(old: ProfilePostItem[] | undefined, postId: string) {
  if (!old) return old;
  return old.filter((post) => post.id !== postId);
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, DeletePostContext>({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc('soft_delete_post', { p_post_id: postId });
      if (error) throw error;
      if (data !== true) {
        throw new Error('Post not deleted');
      }
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      await queryClient.cancelQueries({ queryKey: ['profile'] });
      await queryClient.cancelQueries({ queryKey: ['post', postId] });

      const previousFeeds = queryClient.getQueriesData({ queryKey: ['feed'] });
      const previousProfilePosts = queryClient.getQueriesData({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return queryKey[0] === 'profile' && queryKey[queryKey.length - 1] === 'posts';
        },
      });
      const previousPost = queryClient.getQueryData(['post', postId]);

      queryClient.setQueriesData<FeedCacheData>({ queryKey: ['feed'] }, (old) =>
        removePostFromFeedCache(old, postId)
      );
      queryClient.setQueriesData<ProfilePostItem[]>(
        {
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey[0] === 'profile' && queryKey[queryKey.length - 1] === 'posts';
          },
        },
        (old) => removePostFromProfilePostsCache(old, postId)
      );
      queryClient.setQueryData(['post', postId], null);

      return { previousFeeds, previousProfilePosts, previousPost };
    },
    onError: (error, postId, context) => {
      logger.warn('delete post failed', { message: error.message, postId });

      context?.previousFeeds.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousProfilePosts.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      queryClient.setQueryData(['post', postId], context?.previousPost);
    },
    onSettled: (_data, _error, postId) => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}
