import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const profileQueryKey = ['profile', 'me'] as const;

export type CurrentProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  birthday: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_professional: boolean | null;
  username_changed_at: string | null;
};

export function useProfileQuery() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<CurrentProfile> => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Session expired. Please sign in again.');

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, display_name, username, bio, birthday, avatar_url, cover_url, is_professional, username_changed_at'
        )
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Profile not found.');

      return {
        id: user.id,
        email: user.email ?? null,
        full_name: data.full_name ?? null,
        display_name: data.display_name ?? null,
        username: data.username ?? null,
        bio: data.bio ?? null,
        birthday: data.birthday ?? null,
        avatar_url: data.avatar_url ?? null,
        cover_url: data.cover_url ?? null,
        is_professional: Boolean(data.is_professional),
        username_changed_at: data.username_changed_at ?? null,
      };
    },
  });
}
