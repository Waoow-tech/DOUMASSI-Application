// Hook follow/unfollow — E3-04.
// Gère :
// - L'état de la relation (idle / following / pending / self)
// - Les mutations optimistes (rollback en cas d'erreur)
// - Le branchement status='accepted' (profil public) vs 'pending' (privé)
// - L'invalidation des compteurs de l'user cible + des miens
//
// Note : seul les `status='accepted'` sont comptés dans followers/following
// (cf. useProfile.ts), donc une demande en pending n'incrémente PAS le compteur.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type FollowStatus = 'idle' | 'following' | 'pending' | 'self';

export interface UseFollowReturn {
  status: FollowStatus;
  isLoading: boolean;
  isPending: boolean;
  follow: () => Promise<void>;
  unfollow: () => Promise<void>;
}

interface RelationData {
  isSelf: boolean;
  followStatus: 'accepted' | 'pending' | null;
  targetIsPrivate: boolean;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new Error('No authenticated user');
  }
  return data.session.user.id;
}

async function fetchRelation(targetUserId: string): Promise<RelationData> {
  const currentUserId = await getCurrentUserId();

  if (currentUserId === targetUserId) {
    return { isSelf: true, followStatus: null, targetIsPrivate: false };
  }

  const [followRes, targetRes] = await Promise.all([
    supabase
      .from('follows')
      .select('status')
      .eq('follower_id', currentUserId)
      .eq('followed_id', targetUserId)
      .maybeSingle(),
    supabase.from('profiles').select('is_private').eq('id', targetUserId).single(),
  ]);

  if (followRes.error) {
    logger.warn('Erreur fetch follow relation', { message: followRes.error.message });
  }
  if (targetRes.error) {
    logger.warn('Erreur fetch target is_private', { message: targetRes.error.message });
    throw targetRes.error;
  }

  const rawStatus = followRes.data?.status as string | undefined;
  const followStatus = rawStatus === 'accepted' || rawStatus === 'pending' ? rawStatus : null;

  return {
    isSelf: false,
    followStatus,
    targetIsPrivate: Boolean(targetRes.data?.is_private),
  };
}

function deriveStatus(relation: RelationData | undefined): FollowStatus {
  if (!relation) return 'idle';
  if (relation.isSelf) return 'self';
  if (relation.followStatus === 'accepted') return 'following';
  if (relation.followStatus === 'pending') return 'pending';
  return 'idle';
}

// Bumpe (ou décrémente) le compteur d'une query counters en cache.
// Si la query n'est pas en cache, ne fait rien (le prochain refetch s'en occupera).
function adjustCounter(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  field: 'followers' | 'following',
  delta: number
) {
  queryClient.setQueryData<{ posts: number; followers: number; following: number }>(
    queryKey,
    (old) => (old ? { ...old, [field]: Math.max(0, old[field] + delta) } : old)
  );
}

export function useFollow(targetUserId: string | null): UseFollowReturn {
  const queryClient = useQueryClient();

  const relationQuery = useQuery({
    queryKey: ['follow-relation', targetUserId],
    queryFn: () => fetchRelation(targetUserId as string),
    enabled: targetUserId !== null,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No target user');
      const currentUserId = await getCurrentUserId();
      const relation = relationQuery.data;
      const newStatus = relation?.targetIsPrivate ? 'pending' : 'accepted';

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, followed_id: targetUserId, status: newStatus });

      if (error) throw error;
      return newStatus as 'accepted' | 'pending';
    },
    onMutate: async () => {
      if (!targetUserId) return;
      const relationKey = ['follow-relation', targetUserId];
      await queryClient.cancelQueries({ queryKey: relationKey });
      const previous = queryClient.getQueryData<RelationData>(relationKey);
      const optimisticStatus = previous?.targetIsPrivate ? 'pending' : 'accepted';

      queryClient.setQueryData<RelationData>(relationKey, (old) =>
        old ? { ...old, followStatus: optimisticStatus } : old
      );

      // Bump compteurs uniquement si accepted (pending = pas compté)
      if (optimisticStatus === 'accepted') {
        adjustCounter(queryClient, ['profile', 'user', targetUserId, 'counters'], 'followers', +1);
        adjustCounter(queryClient, ['profile', 'me', 'counters'], 'following', +1);
      }

      return { previous, optimisticStatus };
    },
    onError: (err, _vars, context) => {
      logger.warn('Follow failed, rolling back', { message: (err as Error).message });
      if (!targetUserId || !context) return;
      queryClient.setQueryData(['follow-relation', targetUserId], context.previous);
      if (context.optimisticStatus === 'accepted') {
        adjustCounter(queryClient, ['profile', 'user', targetUserId, 'counters'], 'followers', -1);
        adjustCounter(queryClient, ['profile', 'me', 'counters'], 'following', -1);
      }
    },
    onSettled: () => {
      if (!targetUserId) return;
      void queryClient.invalidateQueries({ queryKey: ['follow-relation', targetUserId] });
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', targetUserId, 'counters'],
      });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me', 'counters'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No target user');
      const currentUserId = await getCurrentUserId();

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', targetUserId);

      if (error) throw error;
    },
    onMutate: async () => {
      if (!targetUserId) return;
      const relationKey = ['follow-relation', targetUserId];
      await queryClient.cancelQueries({ queryKey: relationKey });
      const previous = queryClient.getQueryData<RelationData>(relationKey);
      const wasAccepted = previous?.followStatus === 'accepted';

      queryClient.setQueryData<RelationData>(relationKey, (old) =>
        old ? { ...old, followStatus: null } : old
      );

      if (wasAccepted) {
        adjustCounter(queryClient, ['profile', 'user', targetUserId, 'counters'], 'followers', -1);
        adjustCounter(queryClient, ['profile', 'me', 'counters'], 'following', -1);
      }

      return { previous, wasAccepted };
    },
    onError: (err, _vars, context) => {
      logger.warn('Unfollow failed, rolling back', { message: (err as Error).message });
      if (!targetUserId || !context) return;
      queryClient.setQueryData(['follow-relation', targetUserId], context.previous);
      if (context.wasAccepted) {
        adjustCounter(queryClient, ['profile', 'user', targetUserId, 'counters'], 'followers', +1);
        adjustCounter(queryClient, ['profile', 'me', 'counters'], 'following', +1);
      }
    },
    onSettled: () => {
      if (!targetUserId) return;
      void queryClient.invalidateQueries({ queryKey: ['follow-relation', targetUserId] });
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', targetUserId, 'counters'],
      });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me', 'counters'] });
    },
  });

  return {
    status: deriveStatus(relationQuery.data),
    isLoading: relationQuery.isLoading,
    isPending: followMutation.isPending || unfollowMutation.isPending,
    follow: async () => {
      await followMutation.mutateAsync();
    },
    unfollow: async () => {
      await unfollowMutation.mutateAsync();
    },
  };
}
