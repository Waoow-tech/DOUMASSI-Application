// Sprint 6, ticket #213 — Schéma & helpers de validation des mentions.
//
// Utilisé par les composers (PR B : post composer + message composer) pour
// valider AVANT envoi que :
//   - le contenu ne contient pas plus de 5 mentions (sinon le trigger DB
//     rollback l'INSERT avec une erreur P0001 « Too many mentions »)
//   - chaque mention saisie respecte le format `[a-z0-9_]{3,30}`
//
// Ce fichier ne touche pas aux schémas posts/comments/messages eux-mêmes :
// ils n'existent pas encore en Zod (validation actuelle ad-hoc dans les
// composers). Quand on les Zod-isera (chantier T-09 envisagé), il suffira
// de composer ces helpers avec `.refine(maxFiveMentions, ...)`.

import { z } from 'zod';

import { parseMentions } from '@/components/MentionsText';

/**
 * Plafond cohérent avec la garde côté trigger DB (fn_notify_mention).
 * Si tu changes cette valeur, change AUSSI le `> 5` dans la migration
 * `20260624140100_mentions_trigger_and_helper.sql`.
 */
export const MAX_MENTIONS_PER_CONTENT = 5;

/** Format exact requis pour un username DOUMASSI (cf RPC update_username). */
export const MENTION_USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

/** Compte le nombre de mentions distinctes dans un contenu donné. */
export function countMentions(content: string): number {
  return parseMentions(content ?? '').filter((f) => f.kind === 'mention').length;
}

/** Retourne la liste des usernames mentionnés (lowercase, distincts). */
export function extractMentionedUsernames(content: string): string[] {
  const usernames = parseMentions(content ?? '')
    .filter((f): f is { kind: 'mention'; username: string } => f.kind === 'mention')
    .map((f) => f.username.toLowerCase());
  return Array.from(new Set(usernames));
}

/**
 * Refine Zod réutilisable. Compose-le sur n'importe quel `z.string()` qui
 * représente du contenu rich-text mentionnable (post.content, comment.content,
 * message.content) :
 *
 *   const schema = z.object({
 *     content: z.string().min(1).max(500).refine(...maxMentionsRefine()),
 *   });
 */
export function maxMentionsRefine() {
  return [
    (content: string) => countMentions(content) <= MAX_MENTIONS_PER_CONTENT,
    { message: `Trop de mentions (max ${MAX_MENTIONS_PER_CONTENT} par contenu)` },
  ] as const;
}

/**
 * Schéma standalone pour un contenu mentionnable. Inclut juste la règle
 * mentions — à combiner avec les contraintes propres à chaque entité
 * (longueur min/max, trim, etc.) via `.and(...)`.
 */
export const mentionableContentSchema = z.string().refine(...maxMentionsRefine());
