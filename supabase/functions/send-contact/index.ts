// send-contact — E8-03
//
// Reçoit le formulaire de contact (nom, email, téléphone, entreprise, sujet,
// message), applique un rate limit « 3 / heure / IP » (IP hashée, RGPD), envoie
// l'email vers hello@doumassi.com via Resend, puis journalise la soumission.
//
// Ordre choisi : rate-limit → envoi Resend → insertion. Ainsi une tentative qui
// échoue côté Resend n'est PAS comptée contre le quota (l'utilisateur peut
// réessayer) et on ne journalise que les messages réellement partis.
//
// Secrets requis (Supabase → Edge Functions) :
//   RESEND_API_KEY        (obligatoire)
//   CONTACT_TO            (optionnel, défaut hello@doumassi.com)
//   CONTACT_FROM          (optionnel, défaut « DOUMASSI <onboarding@resend.dev> »)
//   CONTACT_MAX_PER_HOUR  (optionnel, défaut 3)

// eslint-disable-next-line import/no-unresolved
import { createClient } from 'jsr:@supabase/supabase-js@2';

// @ts-expect-error - Deno global, fourni à l'exécution
const Deno = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno!;

interface ContactRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
}

// Bornes serveur (défense en profondeur, indépendantes de la validation client).
const MAX = { name: 120, email: 200, phone: 40, company: 160, subject: 160, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(req: Request): Record<string, string> {
  // On REFLÈTE les headers demandés au preflight : supabase-js (surtout sur le
  // web) envoie x-client-info/apikey/x-region… Une allowlist figée ferait
  // échouer le POST après un preflight pourtant 200. Fallback sur l'ensemble
  // standard si le header n'est pas présent.
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

/** Empreinte SHA-256 de l'IP (jamais stockée en clair). */
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(req, { error: 'server_misconfigured' }, 500);
  }
  if (!resendKey) {
    return json(req, { error: 'server_misconfigured' }, 500);
  }

  const contactTo = Deno.env.get('CONTACT_TO') ?? 'hello@doumassi.com';
  const contactFrom = Deno.env.get('CONTACT_FROM') ?? 'DOUMASSI <onboarding@resend.dev>';
  const maxPerHour = Number(Deno.env.get('CONTACT_MAX_PER_HOUR') ?? '3');

  // Vérifie l'utilisateur connecté (le formulaire vit dans l'espace authentifié).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(req, { error: 'unauthorized' }, 401);
  }

  let body: ContactRequest;
  try {
    body = (await req.json()) as ContactRequest;
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }

  // Normalisation + validation serveur.
  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const phone = (body.phone ?? '').trim();
  const company = (body.company ?? '').trim();
  const subject = (body.subject ?? '').trim();
  const message = (body.message ?? '').trim();

  if (
    !name ||
    name.length > MAX.name ||
    !email ||
    email.length > MAX.email ||
    !EMAIL_RE.test(email) ||
    !subject ||
    subject.length > MAX.subject ||
    message.length < 10 ||
    message.length > MAX.message ||
    phone.length > MAX.phone ||
    company.length > MAX.company
  ) {
    return json(req, { error: 'invalid_input' }, 400);
  }

  // Client service_role pour bypasser la RLS (comptage + insertion).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const ip = clientIp(req);
  const ipHash = ip ? await hashIp(ip) : null;

  // Rate limit : nombre de messages déjà partis depuis cette IP sur 1h.
  if (ipHash && Number.isFinite(maxPerHour) && maxPerHour > 0) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await adminClient
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gt('created_at', since);

    if (countError) {
      console.error('contact_rate_check_failed', countError.message);
      return json(req, { error: 'server_error' }, 500);
    }
    if ((count ?? 0) >= maxPerHour) {
      return json(req, { error: 'rate_limited' }, 429);
    }
  }

  // Envoi de l'email via Resend. reply_to = l'expéditeur → « Répondre » écrit
  // directement à la personne.
  const textLines = [
    `Nom : ${name}`,
    `E-mail : ${email}`,
    phone ? `Téléphone : ${phone}` : null,
    company ? `Entreprise : ${company}` : null,
    `Utilisateur : ${userData.user.id}`,
    '',
    `Sujet : ${subject}`,
    '',
    message,
  ].filter(Boolean);

  const htmlLines = textLines.map((l) => (l === '' ? '<br/>' : esc(String(l)))).join('<br/>');

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: contactFrom,
      to: [contactTo],
      reply_to: email,
      subject: `[Contact] ${subject}`,
      text: textLines.join('\n'),
      html: `<div style="font-family:sans-serif;line-height:1.5">${htmlLines}</div>`,
    }),
  });

  if (!resendResp.ok) {
    const detail = await resendResp.text().catch(() => '');
    console.error('contact_email_failed', resendResp.status, detail.slice(0, 300));
    return json(req, { error: 'email_failed' }, 502);
  }

  // Journalise la soumission (backup + comptage rate limit).
  const { error: insertError } = await adminClient.from('contact_messages').insert({
    user_id: userData.user.id,
    name,
    email,
    phone: phone || null,
    company: company || null,
    subject,
    message,
    ip_hash: ipHash,
  });

  if (insertError) {
    // L'email est déjà parti : on ne renvoie PAS d'erreur à l'utilisateur, on
    // se contente de logguer (perte du backup, pas de la demande).
    console.error('contact_insert_failed', insertError.message);
  }

  return json(req, { ok: true }, 200);
});
