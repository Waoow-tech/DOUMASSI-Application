import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const HIDDEN_POSTS_STORAGE_KEY = 'doumassi:hidden_posts';
export const hiddenPostsQueryKey = ['hidden-posts'] as const;

async function readHiddenPosts() {
  const raw = await AsyncStorage.getItem(HIDDEN_POSTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export function useHiddenPosts() {
  return useQuery({
    queryKey: hiddenPostsQueryKey,
    queryFn: readHiddenPosts,
    staleTime: Infinity,
  });
}

export function useHidePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const list = await readHiddenPosts();
      if (!list.includes(postId)) list.push(postId);
      await AsyncStorage.setItem(HIDDEN_POSTS_STORAGE_KEY, JSON.stringify(list));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hiddenPostsQueryKey }),
  });
}

export function useUnhidePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const list = await readHiddenPosts();
      await AsyncStorage.setItem(
        HIDDEN_POSTS_STORAGE_KEY,
        JSON.stringify(list.filter((id) => id !== postId))
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hiddenPostsQueryKey }),
  });
}
