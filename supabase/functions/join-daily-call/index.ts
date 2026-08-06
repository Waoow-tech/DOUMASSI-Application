// Edge Function : join-daily-call — durcissement sécurité des appels.
//
// POURQUOI
//   `create-daily-call` crée la room + un token pour l'INITIATEUR. Le
//   DESTINATAIRE, lui, rejoignait avec un token vide sur une room publique →
//   n'importe qui avec l'URL pouvait entrer. Désormais la room est PRIVÉE
//   (privacy=private côté create-daily-call), donc un token est obligatoire.
//   Cette fonction délivre au destinataire SON propre meeting token — après
//   avoir vérifié qu'il est bien participant de la conversation de l'appel.
//
// SÉCURITÉ
//   - DAILY_API_KEY ne sort jamais du serveur.
//   - On lit l'appel via le client porteur du JWT : la policy
//     « calls select if participant of conv » ne renvoie la ligne QUE si
//     l'appelant est participant. Un non-participant obtient 0 ligne → 403.
//   - Le token est signé pour CETTE room uniquement, exp court.
//
// Body attendu : { call_id: uuid }
// Réponse : { room_url: string, token: string }

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

const DAILY_API_BASE = 'https://api.daily.co/v1';

interface JoinCallRequest {
  call_id?: string;
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

/** Nom de la room = dernier segment de l'URL Daily (https://sub.daily.co/<room>). */
function roomNameFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

async function createMeetingToken(
  apiKey: string,
  roomName: string,
  userId: string
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // exp = +1h
  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ properties: { room_name: roomName, user_id: userId, exp: expiresAt } }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Daily token failed: ${res.status} ${txt}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
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

  // Client porteur du JWT du caller → la RLS s'applique.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  let body: JoinCallRequest;
  try {
    body = (await req.json()) as JoinCallRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const callId = body.call_id;
  if (!callId) {
    return json({ error: 'call_id is required' }, 400);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // Lecture de l'appel via RLS : ne renvoie la ligne que si je suis participant
  // de la conversation. Sinon 0 ligne → je ne suis pas autorisé à rejoindre.
  const { data: call, error: callError } = await supabase
    .from('calls')
    .select('id, daily_room_url, status, ended_at')
    .eq('id', callId)
    .maybeSingle();

  if (callError || !call) {
    return json({ error: 'Call not found or not a participant' }, 403);
  }

  const callRow = call as { daily_room_url: string | null; ended_at: string | null };
  if (callRow.ended_at) {
    return json({ error: 'Call already ended' }, 409);
  }
  if (!callRow.daily_room_url) {
    return json({ error: 'Call has no room' }, 500);
  }

  const roomName = roomNameFromUrl(callRow.daily_room_url);
  if (!roomName) {
    return json({ error: 'Invalid room url' }, 500);
  }

  let token: string;
  try {
    token = await createMeetingToken(apiKey, roomName, userId);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Daily token error' }, 502);
  }

  return json({ room_url: callRow.daily_room_url, token });
});
