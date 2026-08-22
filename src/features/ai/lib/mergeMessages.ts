// Fusion messages persistés + tour optimiste — E5-03, étendu aux images E5-06.
//
// Fonction PURE, volontairement séparée du hook `useAiChat` : elle ne doit pas
// entraîner ses dépendances (expo/fetch, client Supabase, env) dans les tests.

import type { AiMessage } from '../hooks/useAiConversation';

/** Image d'un message : soit un path privé à signer, soit une URI locale
 *  (optimiste, avant persistance). Exactement l'un des deux est renseigné. */
export interface MessageImage {
  path?: string;
  localUri?: string;
}

export interface PendingTurn {
  /** Message que l'utilisateur vient d'envoyer (affiché immédiatement). */
  userContent: string;
  /** Réponse en cours d'accumulation (vide tant que rien n'est arrivé). */
  assistantContent: string;
  /** true entre l'envoi et le premier fragment → bulle « frappe… ». */
  isWaitingFirstChunk: boolean;
  /** URIs locales des images jointes (affichage optimiste). */
  attachmentUris?: string[];
}

export interface MergedMessage {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
  images: MessageImage[];
}

/** Extrait les images (kind === 'image') des attachments persistés. */
function imagesOf(message: AiMessage): MessageImage[] {
  return (message.attachments ?? [])
    .filter((a) => a.kind === 'image' && typeof a.path === 'string')
    .map((a) => ({ path: a.path }));
}

/** Fusionne les messages persistés et le tour optimiste en cours. */
export function mergeMessages(
  persisted: AiMessage[],
  pending: PendingTurn | null
): MergedMessage[] {
  const base: MergedMessage[] = persisted
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      key: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      streaming: false,
      images: imagesOf(m),
    }));

  if (!pending) return base;

  // Le tour optimiste n'est PAS encore en base : on l'ajoute en fin de liste.
  base.push({
    key: 'pending-user',
    role: 'user',
    content: pending.userContent,
    streaming: false,
    images: (pending.attachmentUris ?? []).map((localUri) => ({ localUri })),
  });
  if (!pending.isWaitingFirstChunk) {
    base.push({
      key: 'pending-assistant',
      role: 'assistant',
      content: pending.assistantContent,
      streaming: true,
      images: [],
    });
  }
  return base;
}
