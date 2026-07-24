// Edge Function : ai-chat — E5-01 (proxy IA) + E5-02 (quota).
//
// Relaie une conversation vers le fournisseur d'IA en STREAMING (SSE) et
// persiste la réponse. Voir ADR-009 pour le choix du fournisseur.
//
// SÉCURITÉ
//   - AI_API_KEY ne sort JAMAIS du serveur. C'est la raison d'être de cette
//     fonction : le client mobile ne doit jamais porter de clé de fournisseur
//     (règle projet, CLAUDE.md).
//   - Le quota est consommé AVANT l'appel au fournisseur, via une RPC atomique
//     (E5-02). Un quota vérifié après coup ne protège de rien.
//   - Le message assistant est écrit avec la clé service_role : la policy
//     `ai_msg_insert_user_role` n'autorise les clients qu'à insérer des
//     messages de rôle 'user'. Un client ne peut donc pas fabriquer de fausses
//     réponses de l'IA.
//
// AGNOSTICISME DU FOURNISSEUR (ADR-009)
//   Mistral, OpenAI, Groq et Ollama exposent tous `/v1/chat/completions`
//   compatible OpenAI avec streaming SSE. Cette fonction ne connaît donc aucun
//   fournisseur : elle lit une URL, une clé et un nom de modèle.
//
//     AI_BASE_URL  ex. https://api.mistral.ai/v1
//     AI_API_KEY   clé du fournisseur (Supabase Vault — jamais commitée)
//     AI_MODEL     ex. mistral-small-latest
//
//   ⚠️ Cet agnosticisme ne vaut QUE pour le chat. La génération d'images, la
//   transcription et les embeddings ont des API propres à chaque fournisseur.
//
// Body attendu :
//   { conversation_id: uuid, content: string }
//
// Réponse : flux SSE
//   data: {"delta":"..."}      fragments de texte, au fil de l'eau
//   data: {"done":true}        fin de la réponse
//   data: {"error":"..."}      erreur survenue en cours de flux

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Deno globals — résolus à l'exécution sur Supabase Edge Runtime.
// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

/** Nombre de messages d'historique renvoyés au modèle. */
const HISTORY_LIMIT = 20;

/** Longueur max d'un message utilisateur (garde-fou de coût et d'abus). */
const MAX_CONTENT_LENGTH = 4000;

interface ChatRequest {
  conversation_id?: string;
  content?: string;
}

interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

/**
 * Consigne système. Volontairement ici et non côté client : un prompt système
 * modifiable par le client n'est pas une consigne, c'est une suggestion.
 *
 * Le rappel sur l'âge n'est pas cosmétique — l'app accueille des utilisateurs
 * de 15 à 17 ans (ADR-008).
 */
const SYSTEM_PROMPT = [
  "Tu es l'assistant de DOUMASSI, une application sociale française.",
  "Tu réponds dans la langue de l'utilisateur, par défaut en français.",
  'Tu es concis et direct. Tu ne prétends jamais être humain.',
  'Une partie des utilisateurs a entre 15 et 17 ans : reste approprié et refuse poliment tout contenu qui ne conviendrait pas à un mineur.',
].join(' ');

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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const baseUrl = Deno.env.get('AI_BASE_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey || !model) {
    // Message explicite : c'est l'erreur de configuration la plus probable au
    // premier déploiement, autant ne pas la faire chercher.
    return json({ error: 'AI provider not configured (AI_BASE_URL / AI_API_KEY / AI_MODEL)' }, 500);
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const conversationId = body.conversation_id;
  const content = body.content?.trim();

  if (!conversationId || !content) {
    return json({ error: 'conversation_id and content are required' }, 400);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return json({ error: 'Message too long' }, 400);
  }

  // Client « utilisateur » : porte le JWT du caller, donc soumis à la RLS.
  // C'est lui qui garantit qu'on ne peut écrire que dans SES conversations.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // -------------------------------------------------------------------------
  // Quota — AVANT tout appel au fournisseur (E5-02)
  // -------------------------------------------------------------------------
  const { data: quotaRows, error: quotaError } = await userClient.rpc('ai_consume_quota');
  if (quotaError) {
    return json({ error: 'Quota check failed' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return json({ error: 'quota_exceeded', used: quota?.used ?? 0, quota: quota?.quota ?? 0 }, 429);
  }

  // -------------------------------------------------------------------------
  // Historique + persistance du message utilisateur
  // -------------------------------------------------------------------------
  // L'INSERT passe par le client utilisateur : si la conversation ne lui
  // appartient pas, la RLS le rejette. On n'a donc pas à revérifier nous-mêmes
  // la propriété de la conversation.
  const { error: insertError } = await userClient
    .from('ai_messages')
    .insert({ conversation_id: conversationId, role: 'user', content });

  if (insertError) {
    return json({ error: 'Conversation not found' }, 403);
  }

  const { data: history } = await userClient
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  // La requête remonte du plus récent au plus ancien (pour prendre les N
  // derniers) : le modèle, lui, attend l'ordre chronologique.
  const messages: StoredMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...((history ?? []) as StoredMessage[]).slice().reverse(),
  ];

  // -------------------------------------------------------------------------
  // Appel au fournisseur, en streaming
  // -------------------------------------------------------------------------
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });
  } catch {
    return json({ error: 'AI provider unreachable' }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_provider_error', upstream.status, detail.slice(0, 500));
    // On ne renvoie pas `detail` au client : il peut contenir des éléments de
    // configuration côté fournisseur.
    return json({ error: 'AI provider error' }, 502);
  }

  // Client « service » : seul habilité à écrire un message de rôle 'assistant'.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = '';
      let fullText = '';

      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Le flux SSE arrive en fragments arbitraires : une ligne peut être
          // coupée en deux entre deux lectures. On ne traite donc que les
          // lignes complètes et on garde le reste en tampon.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                fullText += delta;
                send({ delta });
              }
            } catch {
              // Fragment non-JSON (commentaire de keep-alive, ligne vide) :
              // on l'ignore plutôt que d'interrompre le flux.
            }
          }
        }

        // Persistance de la réponse complète. Faite APRÈS le flux : on ne peut
        // pas écrire un message qu'on n'a pas fini de recevoir.
        if (fullText.length > 0) {
          const { error } = await adminClient.from('ai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullText,
            model_used: model,
          });
          if (error) console.error('ai_assistant_persist_failed', error.message);
        }

        send({ done: true });
      } catch (err) {
        console.error('ai_stream_failed', err instanceof Error ? err.message : String(err));
        send({ error: 'stream_failed' });
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      ...corsHeaders(),
    },
  });
});
