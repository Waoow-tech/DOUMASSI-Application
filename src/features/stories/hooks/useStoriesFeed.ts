// useStoriesFeed — E4-13.
// useQuery sur la RPC get_stories_feed (livrée PR #181). Retourne les
// stories actives de mes follows acceptés + les miennes, mes stories en
// 1er. Le client groupe par author_id côté UI.

import { useMutation, useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type StoryItem = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
  is_mine: boolean;
};

export type StoryUserGroup = {
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  is_mine: boolean;
  stories: StoryItem[];
};

function groupByUser(stories: StoryItem[]): StoryUserGroup[] {
  // Préserve l'ordre retourné par la RPC : mes stories en 1er, puis par
  // created_at desc. On reconstruit en gardant le 1er apparition de chaque
  // author_id comme position du groupe.
  const map = new Map<string, StoryUserGroup>();
  for (const story of stories) {
    const existing = map.get(story.author_id);
    if (existing) {
      existing.stories.push(story);
    } else {
      map.set(story.author_id, {
        author_id: story.author_id,
        author_username: story.author_username,
        author_avatar_url: story.author_avatar_url,
        author_is_verified: story.author_is_verified,
        is_mine: story.is_mine,
        stories: [story],
      });
    }
  }
  // Chaque groupe trié chronologiquement croissant (la 1re story affichée
  // sera la plus ancienne — pattern Instagram).
  for (const group of map.values()) {
    group.stories.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  return Array.from(map.values());
}

export function useStoriesFeed() {
  return useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: async (): Promise<{ groups: StoryUserGroup[] }> => {
      const { data, error } = await supabase.rpc('get_stories_feed');
      if (error) {
        logger.warn('get_stories_feed failed', { message: error.message });
        throw error;
      }
      const stories = (data ?? []) as StoryItem[];
      return { groups: groupByUser(stories) };
    },
    staleTime: 30_000,
  });
}

export function useMarkStoryViewed() {
  return useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase.rpc('create_story_view', { p_story_id: storyId });
      if (error) {
        logger.warn('create_story_view failed', { message: error.message, storyId });
        throw error;
      }
    },
    // Pas d'invalidation : la RPC est idempotente, le viewed_by_me passera
    // à true au prochain refetch naturel (next mount, focus, etc.).
  });
}
