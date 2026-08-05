// Libellé d'une conversation dans le drawer — E5-04.
//
// Pur et testable. La règle de priorité : le titre (posé par E5-05, à venir),
// sinon le 1er message utilisateur tronqué, sinon un libellé de repli.

import type { AiConversationSummary } from '../hooks/useAiConversation';

/** Longueur max de l'aperçu affiché dans la liste. */
const PREVIEW_MAX = 60;

export function conversationLabel(
  conversation: Pick<AiConversationSummary, 'title' | 'preview'>,
  fallback: string
): string {
  const title = conversation.title?.trim();
  if (title) return title;

  const preview = conversation.preview?.trim();
  if (preview) {
    // On coupe sur un mot quand c'est possible, pour éviter « exp… » disgracieux.
    if (preview.length <= PREVIEW_MAX) return preview;
    const truncated = preview.slice(0, PREVIEW_MAX);
    const lastSpace = truncated.lastIndexOf(' ');
    const cut = lastSpace > PREVIEW_MAX * 0.6 ? truncated.slice(0, lastSpace) : truncated;
    return `${cut.trimEnd()}…`;
  }

  // Conversation sans titre ni message (créée puis abandonnée avant d'écrire).
  return fallback;
}
