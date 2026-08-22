// Edge Function `send-push` — E4-14.
//
// Appelée par un trigger DB sur INSERT dans `public.notifications`.
// Récupère le push_token du recipient (table `profiles`), construit un
// message localisé selon le type (`follow`, `like`, `comment`, etc.),
// puis appelle l'Expo Push API.
//
// Secrets attendus (à setter via `supabase secrets set` ou interface admin) :
//   - EXPO_ACCESS_TOKEN : token Bearer pour l'API Expo Push
// Secrets injectés automatiquement par Supabase Edge Functions :
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Side-effect : si Expo retourne `DeviceNotRegistered`, on reset le token
// du profil concerné (sinon on continuerait à push sur un token invalide).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'like'
  | 'comment'
  | 'mention'
  | 'system'
  | 'payment';

interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMessage(
  notif: NotificationRow,
  actorUsername: string | null
): { title: string; body: string; data: Record<string, unknown> } {
  const handle = actorUsername ? `@${actorUsername}` : 'Quelqu’un';

  let body: string;
  switch (notif.type) {
    case 'follow':
      body = `${handle} a commencé à vous suivre`;
      break;
    case 'follow_request':
      body = `${handle} veut vous suivre`;
      break;
    case 'like':
      body = `${handle} a aimé votre post`;
      break;
    case 'comment': {
      const preview = (notif.payload?.preview as string | undefined)?.trim();
      body = preview ? `${handle} a commenté : « ${preview} »` : `${handle} a commenté votre post`;
      break;
    }
    case 'mention':
      body = `${handle} vous a mentionné`;
      break;
    case 'payment': {
      const from = (notif.payload?.from as string | undefined) ?? 'un utilisateur';
      body = `Paiement reçu de ${from}`;
      break;
    }
    case 'system': {
      const title = (notif.payload?.title as string | undefined) ?? 'Nouveauté';
      body = title;
      break;
    }
    default:
      body = 'Vous avez une nouvelle notification';
  }

  return {
    title: 'DOUMASSI',
    body,
    data: {
      notification_id: notif.id,
      type: notif.type,
      entity_type: notif.entity_type,
      entity_id: notif.entity_id,
      actor_id: notif.actor_id,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  try {
    // Le trigger DB envoie le payload { type: 'INSERT', table: 'notifications',
    // record: <NotificationRow>, schema: 'public' }. On accepte aussi un appel
    // direct avec { notification: <NotificationRow> } pour faciliter les tests.
    const payload = await req.json();
    const notification: NotificationRow | undefined = payload.record ?? payload.notification;

    if (!notification?.id || !notification?.recipient_id) {
      return new Response(JSON.stringify({ error: 'Missing notification payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ne pas envoyer de push pour les notifs `follow_request` qui ont déjà
    // un placeholder UX (les demandes de suivi sont surtout traitées in-app).
    // À ajuster selon les retours d'usage post-bêta.
    if (notification.type === 'follow_request') {
      return new Response(JSON.stringify({ ok: true, skipped: 'follow_request' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: recipient, error: recipientErr } = await supabase
      .from('profiles')
      .select('push_token, username')
      .eq('id', notification.recipient_id)
      .single();

    if (recipientErr) throw recipientErr;
    if (!recipient?.push_token) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_push_token' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let actorUsername: string | null = null;
    if (notification.actor_id) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', notification.actor_id)
        .single();
      actorUsername = actor?.username ?? null;
    }

    const message = buildMessage(notification, actorUsername);

    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const expoRes = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        // EXPO_ACCESS_TOKEN n'est requis que pour les comptes Expo en mode
        // "enhanced security" — sinon les push fonctionnent en anonyme. On le
        // passe quand même si présent pour éviter les rate limits.
        ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
      },
      body: JSON.stringify({
        to: recipient.push_token,
        sound: 'default',
        priority: 'high',
        ...message,
      }),
    });

    const expoData = await expoRes.json();

    // Si Expo nous dit que le token n'est plus valide, on le retire du profil.
    // Évite de continuer à essayer un device désinstallé / désinscrit.
    const errorDetails = expoData?.data?.details?.error;
    if (errorDetails === 'DeviceNotRegistered') {
      await supabase
        .from('profiles')
        .update({ push_token: null })
        .eq('id', notification.recipient_id);
    }

    return new Response(JSON.stringify({ ok: true, expo: expoData }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
