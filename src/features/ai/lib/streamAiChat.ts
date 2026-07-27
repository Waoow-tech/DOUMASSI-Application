// Client de streaming pour l'Edge Function `ai-chat` — E5-03.
//
// POURQUOI PAS supabase.functions.invoke()
//
// `invoke()` attend et bufferise TOUTE la réponse avant de la rendre. Ça
// annule le streaming : l'utilisateur verrait un écran figé quelques secondes
// puis la réponse d'un bloc. On appelle donc l'endpoint directement.
//
// POURQUOI expo/fetch ET PAS le fetch global
//
// Le `fetch` de React Native NE SUPPORTE PAS la lecture incrémentale du corps :
// `response.body` y est null, il faut attendre `response.text()`. `expo/fetch`
// (Expo SDK 52+) expose un vrai `ReadableStream` sur `response.body`, ce qui
// permet de lire les fragments SSE au fil de l'eau. C'est la seule raison de sa
// présence ici.

import { fetch as expoFetch } from 'expo/fetch';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { SseParser } from './sseParser';

const FUNCTION_URL = `${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;

export interface StreamAiChatParams {
  conversationId: string;
  content: string;
  /** Appelé à chaque fragment de texte reçu. */
  onDelta: (delta: string) => void;
  /** Appelé une fois la réponse complète. */
  onDone: () => void;
  /** Signal d'annulation (écran démonté, nouvelle requête). */
  signal?: AbortSignal;
}

/** Erreur typée : le caller distingue le quota du reste pour l'affichage. */
export class AiChatError extends Error {
  readonly kind: 'quota' | 'auth' | 'provider' | 'network' | 'unknown';
  readonly used?: number;
  readonly quota?: number;

  constructor(
    kind: AiChatError['kind'],
    message: string,
    extra?: { used?: number; quota?: number }
  ) {
    super(message);
    this.name = 'AiChatError';
    this.kind = kind;
    this.used = extra?.used;
    this.quota = extra?.quota;
  }
}

/**
 * Ouvre le flux SSE et pousse les fragments via `onDelta`.
 *
 * Résout quand le flux se termine proprement (`onDone` déjà appelé), rejette
 * avec une `AiChatError` en cas d'échec. Une annulation via `signal` rejette
 * avec `kind: 'network'` — le caller teste `signal.aborted` pour la distinguer.
 */
export async function streamAiChat({
  conversationId,
  content,
  onDelta,
  onDone,
  signal,
}: StreamAiChatParams): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new AiChatError('auth', 'Session expirée');
  }

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ conversation_id: conversationId, content }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new AiChatError('network', 'Annulé');
    logger.warn('ai_chat_network_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new AiChatError('network', 'Connexion impossible');
  }

  // Erreurs applicatives : le corps est du JSON, pas du SSE.
  if (!response.ok) {
    let payload: { error?: string; used?: number; quota?: number } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // Corps illisible : on reste sur le status.
    }

    if (response.status === 429) {
      throw new AiChatError('quota', payload.error ?? 'quota_exceeded', {
        used: payload.used,
        quota: payload.quota,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AiChatError('auth', payload.error ?? 'unauthorized');
    }
    if (response.status === 502) {
      throw new AiChatError('provider', payload.error ?? 'provider_error');
    }
    throw new AiChatError('unknown', payload.error ?? `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new AiChatError('unknown', 'Réponse sans corps');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  // Applique une liste d'événements. Renvoie true si le flux est terminé
  // (événement `done`), pour arrêter la lecture proprement.
  const apply = (events: ReturnType<SseParser['push']>): boolean => {
    for (const event of events) {
      if (event.type === 'error') throw new AiChatError('provider', event.message);
      if (event.type === 'done') {
        onDone();
        return true;
      }
      onDelta(event.text);
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (apply(parser.push(chunk))) return;
    }

    // Fin de flux : traiter le reliquat éventuel, puis clôturer. Si aucun
    // `{done:true}` n'a été reçu (coupure réseau tardive), on considère quand
    // même la réponse terminée pour ne pas laisser l'UI bloquée en « frappe… ».
    if (apply(parser.flush())) return;
    onDone();
  } catch (err) {
    if (err instanceof AiChatError) throw err;
    if (signal?.aborted) throw new AiChatError('network', 'Annulé');
    throw new AiChatError('unknown', err instanceof Error ? err.message : String(err));
  } finally {
    reader.releaseLock();
  }
}
