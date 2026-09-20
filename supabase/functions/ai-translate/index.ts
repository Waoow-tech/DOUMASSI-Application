// Edge Function : ai-translate — E5-18 (Tools > Traducteur).
//
// Traduit un texte vers une langue cible via le proxy IA (non-streaming).
// Même infra que le chat : auth + quota partagé (ai_consume_quota, 20/j) +
// provider agnostique (ADR-009). La clé AI ne sort jamais du serveur.
//
// Body : { text: string, target_lang: string }
// Réponse : { translation: string } | { error: string }

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

const MAX_TEXT_LENGTH = 4000;
const MAX_LANG_LENGTH = 40;

interface TranslateRequest {
  text?: string;
  target_lang?: string;
}

function corsHeaders(req?: Request): Record<string, string> {
  // Reflète les en-têtes demandés au préflight (supabase-js en envoie plusieurs
  // depuis un navigateur — cf. le fix de ai-suggest-caption).
  const requested = req?.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      requested ?? 'authorization, content-type, x-client-info, apikey, x-region',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const baseUrl = Deno.env.get('AI_BASE_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL');

  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey || !model) {
    return json({ error: 'AI provider not configured (AI_BASE_URL / AI_API_KEY / AI_MODEL)' }, 500);
  }

  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const text = body.text?.trim().slice(0, MAX_TEXT_LENGTH);
  const targetLang = body.target_lang?.trim().slice(0, MAX_LANG_LENGTH);
  if (!text || !targetLang) {
    return json({ error: 'text and target_lang are required' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Quota partagé avec le chat — AVANT l'appel au fournisseur (E5-02).
  const { data: quotaRows, error: quotaError } = await userClient.rpc('ai_consume_quota');
  if (quotaError) {
    return json({ error: 'Quota check failed' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return json({ error: 'quota_exceeded', used: quota?.used ?? 0, quota: quota?.quota ?? 0 }, 429);
  }

  const systemPrompt = [
    'Tu es un traducteur professionnel.',
    `Traduis le texte de l'utilisateur vers : ${targetLang}.`,
    'Réponds UNIQUEMENT avec la traduction — sans guillemets, sans commentaire,',
    "sans explication, sans répéter le texte d'origine.",
  ].join(' ');

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        stream: false,
        max_tokens: 2000,
      }),
    });
  } catch {
    return json({ error: 'AI provider unreachable' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_translate_provider_error', upstream.status, detail.slice(0, 500));
    return json({ error: 'AI provider error' }, 502);
  }

  let completion: {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  try {
    completion = await upstream.json();
  } catch {
    return json({ error: 'AI provider error' }, 502);
  }

  const translation = completion.choices?.[0]?.message?.content?.trim() ?? '';
  if (translation.length === 0) {
    return json({ error: 'No translation produced' }, 502);
  }

  // Monitoring des coûts (E1-15) — best effort.
  const totalTokens = completion.usage?.total_tokens ?? 0;
  if (totalTokens > 0) {
    const { error } = await userClient.rpc('ai_record_tokens', { p_tokens: totalTokens });
    if (error) console.error('ai_record_tokens_failed', error.message);
  }

  return json({ translation });
});
