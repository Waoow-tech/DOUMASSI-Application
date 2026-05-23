// Hooks notifications — E4-17.
// Consomme les RPCs déjà en place (cf. supabase/migrations/20260517100006_notifications_rpcs.sql) :
//   - get_notifications(p_filter, p_limit)            : liste filtrée
//   - count_unread_notifications()                    : badge TabBar
//   - mark_all_notifications_seen()                   : appelé à l'ouverture de l'écran
//   - mark_notification_read(p_notification_id)       : tap individuel
//
// Accept / Reject follow request : direct sur `follows` (le trigger
// fn_notify_follow gère la suppression de la notif follow_request côté serveur
// au passage status=accepted). Pour Reject, on supprime aussi la notif côté
// client (le DELETE de la row follows ne déclenche pas la suppression de notif).
//
// Pagination : la RPC actuelle n'expose pas de cursor → useQuery simple à
// limite 30. À passer en useInfiniteQuery quand la RPC sera étendue.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'like'
  | 'comment'
  | 'mention'
  | 'system'
  | 'payment';

export type NotificationFilter = 'all' | 'unread' | 'social' | 'payment' | 'ai';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_full_name: string | null;
  actor_avatar_url: string | null;
  actor_is_verified: boolean;
  type: NotificationType;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  is_seen: boolean;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 30;
const STALE_MS = 30_000;
const UNREAD_COUNT_REFETCH_MS = 30_000;

const LIST_KEY = ['notifications', 'list'] as const;
const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

// ---------------------------------------------------------------------------
// useNotifications(filter) — liste filtrée
// ---------------------------------------------------------------------------

export function useNotifications(filter: NotificationFilter) {
  return useQuery({
    queryKey: [...LIST_KEY, filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_notifications', {
        p_filter: filter,
        p_limit: PAGE_LIMIT,
      });
      if (error) {
        logger.warn('get_notifications failed', { message: error.message, filter });
        throw error;
      }
      return (data ?? []) as NotificationItem[];
    },
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// useNotificationsUnreadCount — badge TabBar (refetch 30s + on focus)
// ---------------------------------------------------------------------------

export function useNotificationsUnreadCount() {
  const query = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_unread_notifications');
      if (error) {
        logger.warn('count_unread_notifications failed', { message: error.message });
        throw error;
      }
      return typeof data === 'number' ? data : 0;
    },
    staleTime: STALE_MS,
    refetchInterval: UNREAD_COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  return query.data ?? 0;
}

// ---------------------------------------------------------------------------
// useMarkAllNotificationsSeen — appelé 1s après le mount de l'écran
// ---------------------------------------------------------------------------

export function useMarkAllNotificationsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_seen');
      if (error) {
        logger.warn('mark_all_notifications_seen failed', { message: error.message });
        throw error;
      }
    },
    onSuccess: () => {
      // Le badge tombe à 0 immédiatement.
      queryClient.setQueryData(UNREAD_COUNT_KEY, 0);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useMarkNotificationRead — tap individuel sur une row
// ---------------------------------------------------------------------------

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });
      if (error) {
        logger.warn('mark_notification_read failed', { message: error.message });
        throw error;
      }
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      const previous = queryClient.getQueriesData<NotificationItem[]>({ queryKey: LIST_KEY });
      queryClient.setQueriesData<NotificationItem[]>({ queryKey: LIST_KEY }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, is_seen: true } : n
        );
      });
      return { previous };
    },
    onError: (err, _id, context) => {
      logger.warn('mark_notification_read rollback', { message: err.message });
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useAcceptFollowRequest / useRejectFollowRequest
// ---------------------------------------------------------------------------

/**
 * Helper : supprime localement (optimistic) la notif follow_request d'un
 * requester de toutes les caches de liste, renvoie le snapshot pour rollback.
 */
function removeFollowRequestFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  requesterId: string
) {
  const previous = queryClient.getQueriesData<NotificationItem[]>({ queryKey: LIST_KEY });
  queryClient.setQueriesData<NotificationItem[]>({ queryKey: LIST_KEY }, (old) => {
    if (!Array.isArray(old)) return old;
    return old.filter((n) => !(n.type === 'follow_request' && n.actor_id === requesterId));
  });
  return previous;
}

export function useAcceptFollowRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requesterId: string) => {
      // RPC SECURITY DEFINER (cf. migration 20260523120000_follow_request_rpcs.sql)
      // — contourne la RLS de `follows` qui empêchait l'UPDATE direct par le
      // followed_id et faisait un silent no-op.
      const { error } = await supabase.rpc('accept_follow_request', {
        p_requester_id: requesterId,
      });
      if (error) throw error;
    },
    onMutate: async (requesterId) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      const previous = removeFollowRequestFromCache(queryClient, requesterId);
      return { previous };
    },
    onError: (err, _, context) => {
      logger.warn('accept_follow_request failed', { message: err.message });
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Notre count de followers a augmenté côté profil perso.
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me', 'counters'] });
    },
  });
}

export function useRejectFollowRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requesterId: string) => {
      // RPC SECURITY DEFINER : DELETE atomique sur `follows` (la row pending)
      // + `notifications` (la notif follow_request). Évite la RLS qui empêche
      // le followed_id de DELETE et garantit l'atomicité des 2 cleanups.
      const { error } = await supabase.rpc('reject_follow_request', {
        p_requester_id: requesterId,
      });
      if (error) throw error;
    },
    onMutate: async (requesterId) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      const previous = removeFollowRequestFromCache(queryClient, requesterId);
      return { previous };
    },
    onError: (err, _, context) => {
      logger.warn('reject_follow_request failed', { message: err.message });
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
