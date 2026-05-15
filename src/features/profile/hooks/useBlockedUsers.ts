import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { UserRowData } from '../components/UserRow';

export const blockedUsersQueryKey = ['blocks', 'my-blocked'] as const;

type BlockProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

function toUserRowData(profile: BlockProfile): UserRowData {
  return {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    is_verified: Boolean(profile.is_verified),
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    logger.warn('Blocked users session lookup failed', { message: error.message });
    throw error;
  }

  return data.session?.user?.id ?? null;
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: blockedUsersQueryKey,
    queryFn: async (): Promise<UserRowData[]> => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return [];

      const { data, error } = await supabase.rpc('get_my_blocked_users');

      if (error) {
        logger.warn('Blocked users query failed', { message: error.message });
        throw error;
      }

      return ((data ?? []) as BlockProfile[]).map(toUserRowData);
    },
    staleTime: 60_000,
  });
}
