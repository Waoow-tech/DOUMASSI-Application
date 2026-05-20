import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type FeedStory = {
  id: string;
  username: string;
  avatar_url: string | null;
  isMe: boolean;
  hasUnseenStory: boolean;
};

type FollowStoryRow = {
  followed_id: string;
  profile:
    | {
        id: string;
        username: string | null;
        avatar_url: string | null;
      }
    | {
        id: string;
        username: string | null;
        avatar_url: string | null;
      }[]
    | null;
};

function firstProfile(row: FollowStoryRow) {
  return Array.isArray(row.profile) ? row.profile[0] : row.profile;
}

export function useFeedStories() {
  return useQuery({
    queryKey: ['feed', 'stories'],
    queryFn: async (): Promise<FeedStory[]> => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user?.id) {
        throw new Error('No authenticated user');
      }

      const userId = sessionData.session.user.id;

      const [meRes, followsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').eq('id', userId).single(),
        supabase
          .from('follows')
          .select('followed_id, profile:profiles!followed_id(id, username, avatar_url)')
          .eq('follower_id', userId)
          .eq('status', 'accepted')
          .limit(20),
      ]);

      if (meRes.error) {
        logger.warn('fetch feed story self failed', { message: meRes.error.message });
        throw meRes.error;
      }

      if (followsRes.error) {
        logger.warn('fetch feed stories failed', { message: followsRes.error.message });
        throw followsRes.error;
      }

      const meProfile = meRes.data as {
        id: string;
        username: string | null;
        avatar_url: string | null;
      };
      const followingStories = ((followsRes.data ?? []) as FollowStoryRow[])
        .map((row) => firstProfile(row))
        .filter((profile): profile is NonNullable<ReturnType<typeof firstProfile>> => !!profile)
        .map((profile) => ({
          id: profile.id,
          username: profile.username ?? 'user',
          avatar_url: profile.avatar_url,
          isMe: false,
          hasUnseenStory: true,
        }));

      return [
        {
          id: meProfile.id,
          username: meProfile.username ?? 'Moi',
          avatar_url: meProfile.avatar_url,
          isMe: true,
          hasUnseenStory: false,
        },
        ...followingStories,
      ];
    },
    staleTime: 60_000,
  });
}
