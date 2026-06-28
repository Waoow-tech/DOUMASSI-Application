// useProfilesByIds — Sprint 6 follow-up #212/#209.
//
// Récupère en batch les profils (username, full_name, avatar_url) pour une
// liste d'`ids` distincts. Utilisé par ConversationScreen pour résoudre
// `sender_id → username/avatar` sans toucher au SELECT côté messages (qui
// passerait par PostgREST embed) ni au payload Realtime (qui ne supporte pas
// les joins).
//
// Retourne une Map `id → profile` pour résolution O(1) au render des bulles.
// Si `ids` est vide, ne fait pas de query (canQuery = false).

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ProfilePreview {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useProfilesByIds(ids: string[]) {
  // Stabilise la clé : on dédup + on trie pour éviter les invalidations
  // inutiles à chaque re-render qui ajoute/réorganise des messages.
  const stableIds = useMemo(() => Array.from(new Set(ids)).sort(), [ids]);
  const canQuery = stableIds.length > 0;

  const query = useQuery({
    queryKey: ['profiles', 'by-ids', stableIds],
    enabled: canQuery,
    queryFn: async (): Promise<ProfilePreview[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', stableIds);
      if (error) {
        logger.warn('useProfilesByIds failed', { message: error.message });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id ?? ''),
        username: String(row.username ?? ''),
        full_name: (row.full_name as string | null) ?? null,
        avatar_url: (row.avatar_url as string | null) ?? null,
      }));
    },
    // 5min : un profil change rarement et on accepte un léger décalage.
    staleTime: 5 * 60 * 1000,
  });

  const profilesById = useMemo(() => {
    const map = new Map<string, ProfilePreview>();
    for (const p of query.data ?? []) map.set(p.id, p);
    return map;
  }, [query.data]);

  return {
    profilesById,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
