// Edge Function : ai-title — E5-05 (titre auto de conversation).
//
// Après le premier échange, on génère un titre court pour la conversation à
// partir du 1er message utilisateur + 1re réponse assistant. Voir ADR-009 pour
// le fournisseur (même config AI_* que ai-chat).
//
// POURQUOI UNE FONCTION SÉPARÉE (et non dans ai-chat)
//   ai-chat streame — y greffer un 2e appel LLM non-streamé compliquerait le
//   chemin critique et retarderait le `{done:true}`. Ici c'est un appel court,
//   déclenché par le client une seule fois, quand la conversation vient de
//   naître. Le chemin de chat reste intact.
//
// POURQUOI PAS DE QUOTA
//   Le titre est une opération SYSTÈME, pas une requête utilisateur. La compter
//   dans les 20/jour amputerait le quota réel de moitié. L'appel est minuscule
//   (titre = quelques tokens). Le coût est suivi ailleurs (E1-15).
//
// SÉCURITÉ
//   - AI_API_KEY ne sort jamais du serveur (comme ai-chat).
//   - On passe par le client utilisateur (JWT) : la RLS garantit qu'on ne peut
//     lire/écrire que SA conversation. Pas besoin de service_role ici.
//   - Idempotent : si un titre existe déjà, on ne régénère pas.
//
// Body : { conversation_id: uuid }
// Réponse : { title: string } | { error: string }

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

/** Longueur max d'un titre après nettoyage. */
const MAX_TITLE_LENGTH = 60;

interface TitleRequest {
  conversation_id?: string;
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

const TITLE_SYSTEM_PROMPT = [
  'Tu génères un titre court pour une conversation.',
  '3 à 5 mots maximum, dans la LANGUE de la conversation.',
  'Pas de guillemets, pas de ponctuation finale, pas de préfixe « Titre : ».',
  'Réponds UNIQUEMENT par le titre.',
].join(' ');

/** Nettoie la sortie du modèle : guillemets, préfixes, longueur. */
function sanitizeTitle(raw: string): string {
  let title = raw.trim();
  // Enlève d'éventuels guillemets encadrants.
  title = title.replace(/^["'«»\s]+|["'«»\s]+$/g, '');
  // Enlève un préfixe « Titre : » que certains modèles ajoutent.
  title = title.replace(/^(titre|title)\s*:\s*/i, '');
  // Une seule ligne.
  title = title.split('\n')[0]?.trim() ?? '';
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH).trimEnd();
  }
  return title;
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

  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey || !model) {
    return json({ error: 'AI provider not configured' }, 500);
  }

  let body: TitleRequest;
  try {
    body = (await req.json()) as TitleRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const conversationId = body.conversation_id;
  if (!conversationId) {
    return json({ error: 'conversation_id is required' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // La conversation doit exister, m'appartenir (RLS), et ne pas déjà avoir de
  // titre. `.maybeSingle()` → null si la RLS masque la ligne (pas la mienne).
  const { data: conversation, error: convError } = await userClient
    .from('ai_conversations')
    .select('id, title')
    .eq('id', conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    return json({ error: 'Conversation not found' }, 404);
  }
  if ((conversation as { title: string | null }).title) {
    // Déjà titrée : idempotent, on renvoie l'existant sans rappeler le modèle.
    return json({ title: (conversation as { title: string }).title });
  }

  // Les 4 premiers messages suffisent largement à résumer l'intention.
  const { data: history } = await userClient
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(4);

  const messages = ((history ?? []) as StoredMessage[]).filter((m) => m.role !== 'system');
  if (messages.length === 0) {
    return json({ error: 'No messages to summarize' }, 400);
  }

  const transcript = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        // Un titre = quelques tokens. On plafonne bas pour le coût et la latence.
        max_tokens: 20,
        temperature: 0.3,
        messages: [
          { role: 'system', content: TITLE_SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
      }),
    });
  } catch {
    return json({ error: 'AI provider unreachable' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_title_provider_error', upstream.status, detail.slice(0, 300));
    return json({ error: 'AI provider error' }, 502);
  }

  const completion = (await upstream.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const rawTitle = completion?.choices?.[0]?.message?.content ?? '';
  const title = sanitizeTitle(rawTitle);

  if (!title) {
    // Le modèle n'a rien renvoyé d'exploitable : on n'écrit pas de titre vide,
    // l'aperçu (E5-04) reste le libellé de repli.
    return json({ error: 'Empty title' }, 502);
  }

  const { error: updateError } = await userClient
    .from('ai_conversations')
    .update({ title })
    .eq('id', conversationId);

  if (updateError) {
    console.error('ai_title_update_failed', updateError.message);
    return json({ error: 'Failed to save title' }, 500);
  }

  return json({ title });
});
