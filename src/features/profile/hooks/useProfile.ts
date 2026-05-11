// Hook de données du profil courant — E3-01.
// Utilise TanStack Query pour le cache et le refetch automatique.
// 3 queries indépendantes : profil, compteurs, grille de posts.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// --- Types ---

export interface ProfileData {
  id: string;
  username: string;
  display_name: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
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

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new Error('No authenticated user');
  }
  return data.session.user.id;
}

// --- Query functions ---

async function fetchProfileData(): Promise<ProfileData> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, full_name, bio, avatar_url, cover_url, is_verified')
    .eq('id', userId)
    .single();

  if (error) {
    logger.warn('Erreur fetch profile', { message: error.message });
    throw error;
  }

  const raw = data as Record<string, unknown>;
  return {
    ...(data as Omit<ProfileData, 'is_verified'>),
    is_verified: typeof raw.is_verified === 'boolean' ? raw.is_verified : false,
  };
}

// status value must match follows table enum — verified 11/05/2026.
async function fetchProfileCounters(): Promise<ProfileCounters> {
  const userId = await getCurrentUserId();

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
  const userId = await getCurrentUserId();

  // Fetch tous les posts (image + vidéo). Filtre côté client.
  const { data, error } = await supabase
    .from('posts')
    .select('id, image_url, video_url, type')
    .eq('author_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Erreur fetch post grid', { message: error.message });
    throw error;
  }

  // Garde uniquement les posts avec au moins une URL affichable.
  return ((data ?? []) as PostGridItem[]).filter((p) => p.image_url != null || p.video_url != null);
}

// --- Hook principal ---

export function useProfile() {
  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: fetchProfileData,
  });

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
