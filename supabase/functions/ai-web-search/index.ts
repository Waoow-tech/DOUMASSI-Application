// Edge Function : ai-web-search — E5-17.
//
// Recherche web via Tavily (Tier 3 Studio AI), puis synthèse par le LLM avec
// citations [n] renvoyant vers les sources. Même infra que le chat : auth +
// quota partagé (ai_consume_quota) + provider agnostique (ADR-009). Ni la clé
// Tavily ni la clé AI ne sortent du serveur.
//
// Body : { query: string }
// Réponse : { answer: string, sources: { title: string, url: string }[] }
//           { error: string }   (429 = quota_exceeded)

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

const MAX_QUERY_LENGTH = 400;
const MAX_RESULTS = 5;
/** Longueur max du contenu d'une source injecté au LLM (garde-fou de coût). */
const MAX_SNIPPET = 1200;

interface WebSearchRequest {
  query?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

function corsHeaders(req?: Request): Record<string, string> {
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
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const baseUrl = Deno.env.get('AI_BASE_URL');
  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL');
  const tavilyKey = Deno.env.get('TAVILY_API_KEY');

  if (!supabaseUrl || !anonKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }
  if (!baseUrl || !apiKey || !model) {
    return json({ error: 'ai_provider_not_configured' }, 500);
  }
  if (!tavilyKey) {
    return json({ error: 'search_not_configured' }, 500);
  }

  let body: WebSearchRequest;
  try {
    body = (await req.json()) as WebSearchRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const query = body.query?.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) {
    return json({ error: 'query is required' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'unauthorized' }, 401);
  }

  // Quota partagé avec le chat — AVANT tout appel externe (E5-02).
  const { data: quotaRows, error: quotaError } = await userClient.rpc('ai_consume_quota');
  if (quotaError) {
    return json({ error: 'quota_check_failed' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    return json({ error: 'quota_exceeded', used: quota?.used ?? 0, quota: quota?.quota ?? 0 }, 429);
  }

  // 1) Recherche Tavily.
  let tavilyResp: Response;
  try {
    tavilyResp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        max_results: MAX_RESULTS,
        include_answer: false,
      }),
    });
  } catch {
    return json({ error: 'search_unreachable' }, 502);
  }

  if (!tavilyResp.ok) {
    const detail = await tavilyResp.text().catch(() => '');
    console.error('ai_web_search_tavily_error', tavilyResp.status, detail.slice(0, 300));
    return json({ error: 'search_failed' }, 502);
  }

  let tavily: { results?: TavilyResult[] };
  try {
    tavily = await tavilyResp.json();
  } catch {
    return json({ error: 'search_failed' }, 502);
  }

  const results = (tavily.results ?? []).filter((r) => r.url && r.title).slice(0, MAX_RESULTS);

  if (results.length === 0) {
    return json({ answer: '', sources: [] });
  }

  const sources = results.map((r) => ({ title: r.title!.trim(), url: r.url!.trim() }));

  // 2) Synthèse LLM avec citations [n].
  const context = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.content ?? '').trim().slice(0, MAX_SNIPPET)}`
    )
    .join('\n\n');

  const systemPrompt = [
    "Tu réponds à la question de l'utilisateur en te basant UNIQUEMENT sur les résultats de recherche fournis.",
    'Réponds en français, de façon concise et factuelle.',
    'Cite tes sources avec des crochets numérotés [1], [2]… correspondant aux résultats.',
    'Si les résultats ne suffisent pas à répondre, dis-le honnêtement.',
    'Ne mentionne pas que tu es une IA, ne répète pas la question.',
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
          { role: 'user', content: `Question : ${query}\n\nRésultats de recherche :\n${context}` },
        ],
        stream: false,
        max_tokens: 1000,
      }),
    });
  } catch {
    return json({ error: 'ai_provider_unreachable' }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai_web_search_provider_error', upstream.status, detail.slice(0, 500));
    return json({ error: 'ai_provider_error' }, 502);
  }

  let completion: {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  try {
    completion = await upstream.json();
  } catch {
    return json({ error: 'ai_provider_error' }, 502);
  }

  const answer = completion.choices?.[0]?.message?.content?.trim() ?? '';

  // Monitoring des coûts (E1-15) — best effort.
  const totalTokens = completion.usage?.total_tokens ?? 0;
  if (totalTokens > 0) {
    const { error } = await userClient.rpc('ai_record_tokens', { p_tokens: totalTokens });
    if (error) console.error('ai_record_tokens_failed', error.message);
  }

  return json({ answer, sources });
});
