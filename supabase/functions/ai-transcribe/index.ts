// Edge Function : ai-transcribe — E5-12.
//
// Transcrit un court enregistrement vocal en texte via Whisper (fourni par
// Groq, endpoint OpenAI-compatible /audio/transcriptions — cf. ADR-009). Le
// client envoie l'audio encodé en base64 ; on le renvoie tel quel à Whisper en
// multipart. Réutilise l'infra IA : quota partagé (ai_consume_quota), clé qui ne
// sort jamais du serveur.
//
// Body attendu :
//   { audio_base64: string, mime?: string }
//     audio_base64 : contenu binaire de l'enregistrement, encodé base64
//     mime         : type MIME (défaut audio/m4a — sortie d'expo-audio)
//
// Réponse : { text: string }   (transcription)
//           { error: string }  (sur échec ; 429 = quota_exceeded)

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

interface TranscribeRequest {
  audio_base64?: string;
  mime?: string;
}

// Garde-fou de coût / limite serverless : ~10 Mo de base64 ≈ 7,5 Mo d'audio,
// largement de quoi couvrir une note vocale courte (l'UI limite déjà la durée).
const MAX_BASE64_LENGTH = 10_000_000;

function corsHeaders(req: Request): Record<string, string> {
  // On reflète les headers du preflight (supabase-js en envoie plusieurs, surtout
  // sur le web) — fallback sur l'ensemble standard sinon.
  const requested = req.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      requested ?? 'authorization, content-type, x-client-info, apikey',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(req) },
  });
}

/** Décode une chaîne base64 en octets. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(req, { error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const baseUrl = Deno.env.get('AI_BASE_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  // Modèle Whisper dédié (Groq : whisper-large-v3-turbo par défaut).
  const whisperModel = Deno.env.get('AI_WHISPER_MODEL') ?? 'whisper-large-v3-turbo';

  if (!supabaseUrl || !anonKey) {
    return json(req, { error: 'server_misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey) {
    return json(req, { error: 'ai_provider_not_configured' }, 500);
  }

  let body: TranscribeRequest;
  try {
    body = (await req.json()) as TranscribeRequest;
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }

  const audioBase64 = body.audio_base64?.trim();
  const mime = body.mime?.trim() || 'audio/m4a';
  if (!audioBase64) {
    return json(req, { error: 'audio_base64 is required' }, 400);
  }
  if (audioBase64.length > MAX_BASE64_LENGTH) {
    return json(req, { error: 'audio_too_large' }, 413);
  }

  // Utilisateur connecté (soumis à la RLS via son JWT).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(req, { error: 'unauthorized' }, 401);
  }

  // Quota — AVANT l'appel au fournisseur (E5-02), partagé avec le chat.
  const { data: quotaRows, error: quotaError } = await userClient.rpc('ai_consume_quota');
  if (quotaError) {
    return json(req, { error: 'quota_check_failed' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return json(
      req,
      { error: 'quota_exceeded', used: quota?.used ?? 0, quota: quota?.quota ?? 0 },
      429
    );
  }

  // Décodage + construction du multipart pour Whisper.
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(audioBase64);
  } catch {
    return json(req, { error: 'invalid_audio' }, 400);
  }

  const ext =
    mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('webm') ? 'webm' : 'audio';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `audio.${ext}`);
  form.append('model', whisperModel);
  // L'app est française ; forcer la langue améliore la précision et la latence.
  form.append('language', 'fr');
  form.append('response_format', 'json');

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch {
    return json(req, { error: 'ai_provider_unreachable' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_transcribe_provider_error', upstream.status, detail.slice(0, 500));
    return json(req, { error: 'ai_provider_error' }, 502);
  }

  let result: { text?: string };
  try {
    result = await upstream.json();
  } catch {
    return json(req, { error: 'ai_provider_error' }, 502);
  }

  const text = (result.text ?? '').trim();
  return json(req, { text });
});
