// Edge Function : create-daily-call — Ticket #230 (E6-C1).
//
// Crée une room Daily.co + génère un meeting token court-lived, puis INSERT
// la row `calls` correspondante côté Supabase. Retourne `{ call_id, room_url,
// token }` au client.
//
// SÉCURITÉ :
//   - DAILY_API_KEY ne sort JAMAIS du serveur. Le client reçoit un meeting
//     token signé (exp = now+1h) avec les permissions strictes pour cette
//     room uniquement.
//   - On vérifie que l'user appelant est participant de la conversation via
//     la RLS Supabase (le client Supabase initialisé avec le JWT du caller
//     applique automatiquement les policies).
//
// Variables d'env requises (à set via Supabase Vault) :
//   - DAILY_API_KEY    : clé API Daily.co (à récupérer dans dashboard.daily.co
//                       → Developers → API keys, jamais commit)
//   - DAILY_SUBDOMAIN  : sous-domaine Daily.co (ex: "doumassi" pour
//                       doumassi.daily.co)
//
// Body attendu :
//   { conversation_id: uuid, call_type: 'audio' | 'video' }

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Deno globals — résolus à l'exécution sur Supabase Edge Runtime.
// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

const DAILY_API_BASE = 'https://api.daily.co/v1';

interface CreateCallRequest {
  conversation_id?: string;
  call_type?: 'audio' | 'video';
}

interface DailyRoom {
  url: string;
  name: string;
}

interface DailyTokenResponse {
  token: string;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

async function createDailyRoom(apiKey: string): Promise<DailyRoom> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // exp = +1h
  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        exp: expiresAt,
        enable_chat: false,
        max_participants: 10,
        eject_at_room_exp: true,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Daily create room failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as DailyRoom;
}

async function createMeetingToken(
  apiKey: string,
  roomName: string,
  userId: string
): Promise<DailyTokenResponse> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        exp: expiresAt,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Daily token failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as DailyTokenResponse;
}

// @ts-expect-error - Deno global serve API
Deno.serve?.(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('DAILY_API_KEY');
  if (!apiKey) {
    return json({ error: 'DAILY_API_KEY not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing auth' }, 401);

  // Client Supabase avec le JWT du caller — les policies RLS s'appliquent.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  let body: CreateCallRequest;
  try {
    body = (await req.json()) as CreateCallRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { conversation_id, call_type } = body;
  if (!conversation_id || !call_type || !['audio', 'video'].includes(call_type)) {
    return json({ error: 'Invalid params' }, 400);
  }

  // Vérifier que l'user est bien participant de la conversation. La RLS sur
  // `conversation_participants select` n'autorise que mes propres rows, donc
  // si je n'y suis pas, le select retourne 0 rows → on refuse.
  const { data: sessionData } = await supabase.auth.getUser();
  const userId = sessionData?.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { data: participant, error: participantError } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversation_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (participantError || !participant) {
    return json({ error: 'Not a participant of this conversation' }, 403);
  }

  // 1. Créer la room Daily.co
  let room: DailyRoom;
  try {
    room = await createDailyRoom(apiKey);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Daily error' }, 502);
  }

  // 2. Générer un meeting token court-lived pour le caller
  let tokenRes: DailyTokenResponse;
  try {
    tokenRes = await createMeetingToken(apiKey, room.name, userId);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Daily token error' }, 502);
  }

  // 3. INSERT la row calls (RLS policy "insert if initiator and participant"
  //    validera automatiquement que initiator_id = auth.uid()).
  const { data: callRow, error: insertError } = await supabase
    .from('calls')
    .insert({
      conversation_id,
      initiator_id: userId,
      call_type,
      daily_room_url: room.url,
      status: 'ringing',
    })
    .select('id')
    .single();
  if (insertError || !callRow) {
    return json({ error: insertError?.message ?? 'Insert failed' }, 500);
  }

  return json({
    call_id: callRow.id,
    room_url: room.url,
    token: tokenRes.token,
  });
});
