// useResourceComments — E9-16 (#276)
//
// Commentaires d'une ressource (entraide). Accès direct table via RLS :
// lecture publique, insert own, delete own/owner. Join profil auteur via
// l'embedding PostgREST (FK author_id → profiles).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ResourceComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
}

type Row = Record<string, unknown>;

function mapRow(row: Row): ResourceComment {
  const author = (row.author ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    content: String(row.content ?? ''),
    created_at: String(row.created_at ?? ''),
    author_id: String(row.author_id ?? ''),
    author_username: String(author.username ?? ''),
    author_avatar_url: (author.avatar_url as string | null) ?? null,
    author_is_verified: Boolean(author.is_verified ?? false),
  };
}

export function resourceCommentsQueryKey(resourceId: string) {
  return ['cours', 'comments', resourceId] as const;
}

export function useResourceComments(resourceId: string | null) {
  return useQuery({
    queryKey: resourceId ? resourceCommentsQueryKey(resourceId) : ['cours', 'comments', 'none'],
    enabled: Boolean(resourceId),
    queryFn: async (): Promise<ResourceComment[]> => {
      if (!resourceId) return [];
      const { data, error } = await supabase
        .from('resource_comments')
        .select(
          'id, content, created_at, author_id, author:profiles(username, avatar_url, is_verified)'
        )
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false });
      if (error) {
        logger.warn('useResourceComments failed', { message: error.message, resourceId });
        throw error;
      }
      return ((data ?? []) as Row[]).map(mapRow);
    },
    staleTime: 15_000,
  });
}

export function useResourceCommentCount(resourceId: string | null) {
  return useQuery({
    queryKey: resourceId
      ? ['cours', 'comments', 'count', resourceId]
      : ['cours', 'comments', 'count', 'none'],
    enabled: Boolean(resourceId),
    queryFn: async (): Promise<number> => {
      if (!resourceId) return 0;
      const { count, error } = await supabase
        .from('resource_comments')
        .select('id', { count: 'exact', head: true })
        .eq('resource_id', resourceId);
      if (error) {
        logger.warn('useResourceCommentCount failed', { message: error.message });
        throw error;
      }
      return count ?? 0;
    },
    staleTime: 15_000,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { resourceId: string; content: string }>({
    mutationFn: async ({ resourceId, content }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error(getT().cours.common.notAuthenticated);
      const { error } = await supabase
        .from('resource_comments')
        .insert({ resource_id: resourceId, author_id: userId, content: content.trim() });
      if (error) {
        logger.warn('add comment failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: (_r, { resourceId }) => {
      void queryClient.invalidateQueries({ queryKey: resourceCommentsQueryKey(resourceId) });
      void queryClient.invalidateQueries({ queryKey: ['cours', 'comments', 'count', resourceId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { commentId: string; resourceId: string }>({
    mutationFn: async ({ commentId }) => {
      const { error } = await supabase.from('resource_comments').delete().eq('id', commentId);
      if (error) {
        logger.warn('delete comment failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: (_r, { resourceId }) => {
      void queryClient.invalidateQueries({ queryKey: resourceCommentsQueryKey(resourceId) });
      void queryClient.invalidateQueries({ queryKey: ['cours', 'comments', 'count', resourceId] });
    },
  });
}
