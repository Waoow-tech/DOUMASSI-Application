// Hook de données du profil — E3-01 / E3-02 / E3-03.
// Utilise TanStack Query pour le cache et le refetch automatique.
//
// useCurrentProfile : query profil de l'user connecté (utilisée par l'édition).
// useProfile : compose profil + counters + posts pour l'user connecté (ProfileScreen).
// useUserProfile(userId) : profil + counters + posts d'un autre user (E3-03).

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// --- Types ---

export const profileQueryKey = ['profile', 'me'] as const;

export interface ProfileData {
  id: string;
  email: string | null;
  username: string;
  full_name: string | null;
  bio: string | null;
  birthday: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_professional: boolean;
  is_verified: boolean;
  is_private: boolean;
  /** E13-03 — visible dans la mise en relation (opt-in explicite). */
  matching_opt_in: boolean;
  username_changed_at: string | null;
}

export interface ProfileCounters {
  posts: number;
  followers: number;
  following: number;
}

export interface PostGridItem {
  id: string;
  image_url: string | null;
  video_url: string | null;
  type: 'image' | 'video';
}

// --- Helpers ---

async function getCurrentUser(): Promise<{ id: string; email: string | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new Error('No authenticated user');
  }
  return { id: data.session.user.id, email: data.session.user.email ?? null };
}

// --- Query functions (génériques sur userId) ---

async function fetchProfileById(userId: string, email: string | null = null): Promise<ProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, full_name, bio, birthday, avatar_url, cover_url, is_professional, is_verified, is_private, matching_opt_in, username_changed_at'
    )
    .eq('id', userId)
    .single();

  if (error) {
    logger.warn('Erreur fetch profile', { userId, message: error.message });
    throw error;
  }

  const raw = data as Record<string, unknown>;
  return {
    id: userId,
    email,
    username: (raw.username as string) ?? '',
    full_name: (raw.full_name as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
    birthday: (raw.birthday as string | null) ?? null,
    avatar_url: (raw.avatar_url as string | null) ?? null,
    cover_url: (raw.cover_url as string | null) ?? null,
    is_professional: typeof raw.is_professional === 'boolean' ? raw.is_professional : false,
    is_verified: typeof raw.is_verified === 'boolean' ? raw.is_verified : false,
    is_private: typeof raw.is_private === 'boolean' ? raw.is_private : false,
    matching_opt_in: typeof raw.matching_opt_in === 'boolean' ? raw.matching_opt_in : false,
    username_changed_at: (raw.username_changed_at as string | null) ?? null,
  };
}

// status value must match follows table enum — verified 11/05/2026.
async function fetchCountersByUserId(userId: string): Promise<ProfileCounters> {
  const [postsRes, followersRes, followingRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .is('deleted_at', null),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', userId)
      .eq('status', 'accepted'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .eq('status', 'accepted'),
  ]);

  if (postsRes.error) {
    logger.warn('Erreur count posts', { userId, message: postsRes.error.message });
  }
  if (followersRes.error) {
    logger.warn('Erreur count followers', { userId, message: followersRes.error.message });
  }
  if (followingRes.error) {
    logger.warn('Erreur count following', { userId, message: followingRes.error.message });
  }

  return {
    posts: postsRes.count ?? 0,
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

async function fetchPostGridByUserId(userId: string): Promise<PostGridItem[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, image_url, video_url, type')
    .eq('author_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Erreur fetch post grid', { userId, message: error.message });
    throw error;
  }

  // Garde uniquement les posts avec au moins une URL affichable.
  return ((data ?? []) as PostGridItem[]).filter((p) => p.image_url != null || p.video_url != null);
}

// --- Hooks ---

// Profil de l'user connecté seul — utilisé par l'écran d'édition.
export function useCurrentProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => {
      const user = await getCurrentUser();
      return fetchProfileById(user.id, user.email);
    },
  });
}

// Composition profil + counters + posts (user connecté) — utilisé par ProfileScreen.
export function useProfile() {
  const profileQuery = useCurrentProfile();
  const userId = profileQuery.data?.id ?? null;

  const countersQuery = useQuery({
    queryKey: ['profile', 'me', 'counters'],
    queryFn: () => fetchCountersByUserId(userId as string),
    enabled: userId !== null,
  });

  const postsQuery = useQuery({
    queryKey: ['profile', 'me', 'posts'],
    queryFn: () => fetchPostGridByUserId(userId as string),
    enabled: userId !== null,
  });

  return {
    profile: profileQuery.data ?? null,
    userId,
    counters: countersQuery.data ?? { posts: 0, followers: 0, following: 0 },
    posts: postsQuery.data ?? [],
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError || countersQuery.isError,
    refetch: () => {
      void profileQuery.refetch();
      void countersQuery.refetch();
      void postsQuery.refetch();
    },
  };
}

// Profil d'un autre user — utilisé par E3-03 (Profil d'un autre utilisateur).
// La relation (follow status, blocks) est gérée séparément par useFollow (E3-04).
export function useUserProfile(userId: string | null) {
  const profileQuery = useQuery({
    queryKey: ['profile', 'user', userId],
    queryFn: () => fetchProfileById(userId as string),
    enabled: userId !== null,
  });

  const countersQuery = useQuery({
    queryKey: ['profile', 'user', userId, 'counters'],
    queryFn: () => fetchCountersByUserId(userId as string),
    enabled: userId !== null,
  });

  const postsQuery = useQuery({
    queryKey: ['profile', 'user', userId, 'posts'],
    queryFn: () => fetchPostGridByUserId(userId as string),
    enabled: userId !== null,
  });

  return {
    profile: profileQuery.data ?? null,
    counters: countersQuery.data ?? { posts: 0, followers: 0, following: 0 },
    posts: postsQuery.data ?? [],
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError || countersQuery.isError,
    refetch: () => {
      void profileQuery.refetch();
      void countersQuery.refetch();
      void postsQuery.refetch();
    },
  };
}
