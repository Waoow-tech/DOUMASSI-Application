// usePushNotificationsHandler — E4-14.
// Handler de tap d'une notification push : route vers l'écran concerné
// selon `data.type` + `data.entity_id` poussés par l'Edge Function
// `send-push` (cf supabase/functions/send-push/index.ts).
//
// Logique de routing alignée avec `handlePressNotif` côté NotificationsScreen
// (in-app) pour rester cohérent : peu importe que l'user tape une notif
// in-app ou une notif push, il atterrit au même endroit.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { logger } from '@/lib/logger';

interface PushPayload {
  type?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  notification_id?: string;
}

function routeFromPayload(payload: PushPayload): void {
  const { type, entity_id, actor_id } = payload;
  switch (type) {
    case 'follow':
    case 'follow_request':
      if (actor_id) router.push(`/profile/${actor_id}`);
      return;
    case 'like':
    case 'comment':
    case 'mention':
      if (entity_id) router.push(`/post/${entity_id}`);
      return;
    case 'system':
    case 'payment':
      // Pas d'écran dédié pour le MVP — on ouvre l'écran Notifications par défaut
      router.push('/notifications');
      return;
    default:
      router.push('/notifications');
      return;
  }
}

/**
 * S'abonne aux taps de notifications push (foreground + background).
 * À monter une seule fois dans `AuthenticatedTabs`.
 *
 * Cas particulier : si l'app est lancée FROIDE depuis une notif (cold start),
 * `getLastNotificationResponseAsync` permet de récupérer la notif qui a
 * lancé l'app — on la route au mount.
 */
export function usePushNotificationsHandler(): void {
  useEffect(() => {
    // Cold start : si l'app a été ouverte via un tap notif, on a la réponse ici.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const payload = response.notification.request.content.data as PushPayload | undefined;
      if (payload) routeFromPayload(payload);
    });

    // Foreground / background : tap sur une notif déjà reçue.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const payload = response.notification.request.content.data as PushPayload | undefined;
        if (payload) routeFromPayload(payload);
      } catch (err) {
        logger.warn('push_tap_routing_failed', { error: (err as Error).message });
      }
    });

    return () => subscription.remove();
  }, []);
}
