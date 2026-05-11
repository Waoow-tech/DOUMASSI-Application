// Hook de données du profil courant — E3-01 / E3-02.
// Utilise TanStack Query pour le cache et le refetch automatique.
// 3 queries indépendantes : profil, compteurs, grille de posts.
//
// useCurrentProfile : query profil uniquement (utilisée par l'édition).
// useProfile : compose profil + counters + posts (utilisée par ProfileScreen).

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

// --- Query functions ---

async function fetchProfileData(): Promise<ProfileData> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, full_name, bio, birthday, avatar_url, cover_url, is_professional, is_verified, username_changed_at'
    )
    .eq('id', user.id)
    .single();

  if (error) {
    logger.warn('Erreur fetch profile', { message: error.message });
    throw error;
  }

  const raw = data as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email,
    username: (raw.username as string) ?? '',
    full_name: (raw.full_name as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
    birthday: (raw.birthday as string | null) ?? null,
    avatar_url: (raw.avatar_url as string | null) ?? null,
    cover_url: (raw.cover_url as string | null) ?? null,
    is_professional: typeof raw.is_professional === 'boolean' ? raw.is_professional : false,
    is_verified: typeof raw.is_verified === 'boolean' ? raw.is_verified : false,
    username_changed_at: (raw.username_changed_at as string | null) ?? null,
  };
}

// status value must match follows table enum — verified 11/05/2026.
async function fetchProfileCounters(): Promise<ProfileCounters> {
  const user = await getCurrentUser();

  const [postsRes, followersRes, followingRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', user.id)
      .eq('status', 'accepted'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id)
      .eq('status', 'accepted'),
  ]);

  if (postsRes.error) {
    logger.warn('Erreur count posts', { message: postsRes.error.message });
  }
  if (followersRes.error) {
    logger.warn('Erreur count followers', {
      message: followersRes.error.message,
    });
  }
  if (followingRes.error) {
    logger.warn('Erreur count following', {
      message: followingRes.error.message,
    });
  }

  return {
    posts: postsRes.count ?? 0,
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

async function fetchPostGrid(): Promise<PostGridItem[]> {
  const user = await getCurrentUser();

  // Fetch tous les posts (image + vidéo). Filtre côté client.
  const { data, error } = await supabase
    .from('posts')
    .select('id, image_url, video_url, type')
    .eq('author_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Erreur fetch post grid', { message: error.message });
    throw error;
  }

  // Garde uniquement les posts avec au moins une URL affichable.
  return ((data ?? []) as PostGridItem[]).filter((p) => p.image_url != null || p.video_url != null);
}

// --- Hooks ---

// Profil seul — utilisé par l'écran d'édition.
export function useCurrentProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfileData,
  });
}

// Composition profil + counters + posts — utilisé par ProfileScreen.
export function useProfile() {
  const profileQuery = useCurrentProfile();

  const countersQuery = useQuery({
    queryKey: ['profile', 'me', 'counters'],
    queryFn: fetchProfileCounters,
  });

  const postsQuery = useQuery({
    queryKey: ['profile', 'me', 'posts'],
    queryFn: fetchPostGrid,
  });

  return {
    profile: profileQuery.data ?? null,
    userId: profileQuery.data?.id ?? null,
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
