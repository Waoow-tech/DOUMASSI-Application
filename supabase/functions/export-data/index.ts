// Edge Function `export-data` — E8-09.
//
// Conformité RGPD article 20 (droit à la portabilité). L'user appelle cet
// endpoint depuis Settings → Compte → « Exporter mes données » et reçoit en
// retour un JSON consolidé avec toutes les données personnelles auxquelles
// son JWT donne accès.
//
// Pattern :
//   - Client scoppé sur le JWT de l'user (la RLS s'applique sur chaque
//     SELECT, ce qui garantit qu'on n'exporte que les données de cet user)
//   - Aucune escalade de privilèges, aucune utilisation de service_role
//   - Réponse en téléchargement direct : Content-Disposition: attachment
//   - Tronquage des messages les plus anciens si JSON > 10 MB (rare en bêta)
//
// Tables exportées (Phase 1 — bêta) :
//   profiles, posts, comments, stories, follows, likes, bookmarks, blocks,
//   conversations + conversation_participants + messages,
//   deletion_requests, notifications
//
// Hors scope bêta : ai_conversations, listings (pas de données en prod).
//
// Secrets injectés automatiquement par Supabase Edge Functions :
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Limite avant tronquage (sérialisé). Au-delà, on coupe les messages les plus
// anciens. En pratique en bêta on est très loin de 10 MB par user.
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(405, 'method_not_allowed', 'Use POST or GET');
  }

  // 1. JWT requis
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'missing_auth', 'Authorization header required');
  }
  const userJwt = authHeader.replace('Bearer ', '');

  // 2. Client scoppé sur le JWT user → RLS s'applique
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  // 3. Récupère l'user_id depuis le JWT
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonError(401, 'invalid_session', 'Session not valid');
  }
  const userId = userData.user.id;

  // 4. Assemblage des sections en parallèle (RLS appliquée sur chacune)
  // On utilise Promise.all pour minimiser la latence — chaque section est
  // indépendante.
  let truncated = false;

  const [
    profile,
    posts,
    comments,
    stories,
    follows,
    likes,
    bookmarks,
    blocks,
    conversationsData,
    deletionRequests,
    notifications,
  ] = await Promise.all([
    selectOne(userClient, 'profiles', 'id', userId),
    selectMany(userClient, 'posts', 'author_id', userId),
    selectMany(userClient, 'comments', 'author_id', userId),
    selectMany(userClient, 'stories', 'author_id', userId),
    selectFollows(userClient, userId),
    selectMany(userClient, 'likes', 'user_id', userId),
    selectMany(userClient, 'bookmarks', 'user_id', userId),
    selectMany(userClient, 'blocks', 'blocker_id', userId),
    selectConversations(userClient, userId),
    selectMany(userClient, 'deletion_requests', 'user_id', userId),
    selectMany(userClient, 'notifications', 'recipient_id', userId),
  ]);

  // 5. URLs Storage publiques (l'user peut télécharger depuis le navigateur)
  // Note : on n'inclut pas les fichiers binaires dans le JSON pour rester sous
  // 10 MB. Si la demande est forte en bêta, on pourra basculer sur un ZIP V2.
  const storageUrls = buildStorageUrls(profile, posts);

  // 6. Construction du payload final
  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile,
    posts,
    comments,
    stories,
    follows,
    likes,
    bookmarks,
    blocks,
    conversations: conversationsData,
    deletion_requests: deletionRequests,
    notifications,
    storage_urls: storageUrls,
    truncated: false,
  };

  // 7. Tronquage si > 10 MB (extrême edge case)
  let serialized = JSON.stringify(payload, null, 2);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    truncated = true;
    // On tronque la conversation la plus volumineuse en gardant les 100
    // messages les plus récents par conversation
    if (Array.isArray(conversationsData)) {
      for (const conv of conversationsData) {
        if (
          conv &&
          typeof conv === 'object' &&
          'messages' in conv &&
          Array.isArray((conv as { messages: unknown[] }).messages)
        ) {
          const c = conv as { messages: unknown[] };
          c.messages = c.messages.slice(0, 100);
        }
      }
    }
    payload.truncated = true;
    serialized = JSON.stringify(payload, null, 2);
  }

  // 8. Téléchargement direct
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `doumassi-export-${userId.slice(0, 8)}-${dateStr}.json`;

  return new Response(serialized, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Truncated': truncated ? 'true' : 'false',
    },
  });
});

// ===== Helpers =====

async function selectOne(
  client: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client.from(table).select('*').eq(column, value).maybeSingle();
  if (error) {
    console.warn(`selectOne(${table}) error:`, error.message);
    return null;
  }
  return data as Record<string, unknown> | null;
}

async function selectMany(
  client: ReturnType<typeof createClient>,
  table: string,
  column: string,
  value: string
): Promise<unknown[]> {
  const { data, error } = await client.from(table).select('*').eq(column, value);
  if (error) {
    console.warn(`selectMany(${table}) error:`, error.message);
    return [];
  }
  return data ?? [];
}

// follows : 2 directions à exporter (je suis follower OU followed)
async function selectFollows(
  client: ReturnType<typeof createClient>,
  userId: string
): Promise<{ following: unknown[]; followers: unknown[] }> {
  const [followingResult, followersResult] = await Promise.all([
    client.from('follows').select('*').eq('follower_id', userId),
    client.from('follows').select('*').eq('followed_id', userId),
  ]);
  return {
    following: followingResult.data ?? [],
    followers: followersResult.data ?? [],
  };
}

// conversations : 1 ligne par conv dont je suis participant, avec participants
// + mes messages dans cette conv (RLS me laisse aussi voir ceux des autres)
async function selectConversations(
  client: ReturnType<typeof createClient>,
  userId: string
): Promise<unknown[]> {
  // 1. Liste mes conv_ids
  const { data: myParticipations, error: pError } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (pError || !myParticipations) {
    console.warn('selectConversations participants error:', pError?.message);
    return [];
  }
  const convIds = myParticipations.map((p) => p.conversation_id);
  if (convIds.length === 0) return [];

  // 2. Récupère les conversations + participants + messages en parallèle
  const [convs, parts, msgs] = await Promise.all([
    client.from('conversations').select('*').in('id', convIds),
    client.from('conversation_participants').select('*').in('conversation_id', convIds),
    client.from('messages').select('*').in('conversation_id', convIds),
  ]);

  const convsData = convs.data ?? [];
  const partsData = parts.data ?? [];
  const msgsData = msgs.data ?? [];

  // 3. Assemblage : 1 entrée par conv avec participants[] et messages[]
  return convsData.map((c) => ({
    ...c,
    participants: partsData.filter((p) => p.conversation_id === c.id),
    messages: msgsData
      .filter((m) => m.conversation_id === c.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));
}

function buildStorageUrls(
  profile: Record<string, unknown> | null,
  posts: unknown[]
): Record<string, unknown> {
  const urls: Record<string, unknown> = {};
  if (profile) {
    if (profile.avatar_url) urls.avatar = profile.avatar_url;
    if (profile.cover_url) urls.cover = profile.cover_url;
  }
  // Extraction des media_urls des posts (champ text[] dans la table)
  const postMedia: string[] = [];
  for (const p of posts) {
    if (p && typeof p === 'object' && 'media_urls' in p) {
      const m = (p as { media_urls: unknown }).media_urls;
      if (Array.isArray(m)) postMedia.push(...m.filter((u) => typeof u === 'string'));
    }
  }
  if (postMedia.length > 0) urls.post_media = postMedia;
  return urls;
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
