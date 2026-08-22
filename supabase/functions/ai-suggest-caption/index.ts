// Edge Function : ai-suggest-caption — E5-14.
//
// Génère 3 suggestions de légende pour un post à partir de son image, via le
// modèle Vision. NON-streaming (réponse courte, one-shot) — contrairement à
// ai-chat. Réutilise la même infra : quota partagé (ai_consume_quota),
// provider agnostique (ADR-009), bucket privé ai-attachments + URL signée.
//
// SÉCURITÉ (identique à ai-chat)
//   - AI_API_KEY ne sort jamais du serveur.
//   - Quota consommé AVANT l'appel au fournisseur (E5-02) : une suggestion coûte
//     comme un message de chat (rate limit 20/j partagé).
//   - L'image vit dans le bucket PRIVÉ ai-attachments ; on la signe à courte
//     durée pour que le fournisseur Vision la lise, puis l'URL expire.
//
// Body attendu :
//   { image_path: string, context?: string }
//     image_path : path dans ai-attachments (retour de uploadAiImage côté client)
//     context    : texte déjà saisi par l'utilisateur (optionnel, oriente le ton)
//
// Réponse : { suggestions: string[] }   (jusqu'à 3 légendes)
//           { error: string }           (sur échec)

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

/** Durée de vie de l'URL signée envoyée au fournisseur Vision (secondes). */
const SIGNED_URL_TTL = 300;

/** Longueur max du contexte utilisateur (garde-fou de coût). */
const MAX_CONTEXT_LENGTH = 500;

/** Nombre de suggestions attendues. */
const SUGGESTION_COUNT = 3;

interface SuggestRequest {
  image_path?: string;
  context?: string;
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

// Consignes système. Le rappel sur l'âge n'est pas cosmétique : l'app accueille
// des 15-17 ans (ADR-008). On demande 3 tons distincts, une légende par ligne,
// sans numérotation ni préfixe — pour un parsing simple et robuste.
const SYSTEM_PROMPT = [
  'Tu écris des légendes pour un post sur DOUMASSI, une application sociale française.',
  `À partir de l'image (et du texte déjà saisi s'il y en a), propose ${SUGGESTION_COUNT} légendes courtes en français,`,
  'dans 3 tons différents : chaleureuse, inspirante, drôle.',
  'Chaque légende fait une phrase, reste appropriée pour un public mineur, et évite les hashtags sauf si vraiment pertinent.',
  `Réponds UNIQUEMENT avec les ${SUGGESTION_COUNT} légendes, une par ligne, sans numéro, sans tiret, sans nom de ton, sans guillemets.`,
].join(' ');

/**
 * Nettoie la sortie du modèle en une liste de légendes. On retire les préfixes
 * courants (numéros « 1. », tirets « - », labels « Chaleureuse : », guillemets)
 * que le modèle ajoute parfois malgré la consigne.
 */
function parseSuggestions(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^\s*\d+[.)]\s*/, '') // "1. " / "1) "
        .replace(/^\s*[-*•]\s*/, '') // "- " / "* " / "• "
        .replace(/^\s*(chaleureuse|inspirante|dr[ôo]le)\s*[:\-–]\s*/i, '') // "Ton : "
        .replace(/^["“«»']+|["“«»']+$/g, '') // guillemets encadrants
        .trim()
    )
    .filter((line) => line.length > 0)
    .slice(0, SUGGESTION_COUNT);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
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
  // La suggestion REQUIERT de lire l'image → modèle Vision. À défaut, on retombe
  // sur AI_MODEL (qui peut ne pas savoir lire les images → erreur de config).
  const visionModel = Deno.env.get('AI_VISION_MODEL') ?? model;

  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey || !visionModel) {
    return json({ error: 'AI provider not configured (AI_BASE_URL / AI_API_KEY / AI_MODEL)' }, 500);
  }

  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const imagePath = body.image_path?.trim();
  const context = body.context?.trim().slice(0, MAX_CONTEXT_LENGTH) ?? '';
  if (!imagePath) {
    return json({ error: 'image_path is required' }, 400);
  }

  // Client « utilisateur » : porte le JWT du caller → soumis à la RLS (il ne
  // peut signer QUE ses propres pièces jointes).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Quota — AVANT l'appel au fournisseur (E5-02), partagé avec le chat.
  const { data: quotaRows, error: quotaError } = await userClient.rpc('ai_consume_quota');
  if (quotaError) {
    return json({ error: 'Quota check failed' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return json({ error: 'quota_exceeded', used: quota?.used ?? 0, quota: quota?.quota ?? 0 }, 429);
  }

  // Signature de l'image (bucket privé). La RLS Storage garantit que l'user ne
  // signe que ses propres fichiers ; un échec = image inexistante ou non permise.
  const { data: signed, error: signError } = await userClient.storage
    .from('ai-attachments')
    .createSignedUrl(imagePath, SIGNED_URL_TTL);
  if (signError || !signed?.signedUrl) {
    return json({ error: 'Image not found' }, 404);
  }

  const userText =
    context.length > 0
      ? `Texte déjà saisi par l'utilisateur (à prendre en compte) : "${context}"`
      : "L'utilisateur n'a pas encore écrit de texte.";

  const requestBody: Record<string, unknown> = {
    model: visionModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: signed.signedUrl } },
        ],
      },
    ],
    stream: false,
    // Qwen (modèle Vision) est aussi un modèle de raisonnement : on masque le
    // bloc « thinking » pour ne récupérer que les légendes (cf. ai-chat).
    reasoning_format: 'hidden',
    // Réponse courte : 3 phrases suffisent.
    max_tokens: 300,
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return json({ error: 'AI provider unreachable' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_suggest_caption_provider_error', upstream.status, detail.slice(0, 500));
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

  const rawText = completion.choices?.[0]?.message?.content ?? '';
  const suggestions = parseSuggestions(rawText);

  if (suggestions.length === 0) {
    return json({ error: 'No suggestion produced' }, 502);
  }

  // Monitoring des coûts (E1-15) — best effort, ne casse pas la réponse.
  const totalTokens = completion.usage?.total_tokens ?? 0;
  if (totalTokens > 0) {
    const { error } = await userClient.rpc('ai_record_tokens', { p_tokens: totalTokens });
    if (error) console.error('ai_record_tokens_failed', error.message);
  }

  return json({ suggestions });
});
