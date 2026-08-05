// Déclenche la génération du titre d'une conversation — E5-05.
//
// Appelle l'Edge Function `ai-title` (non-streamée → `functions.invoke` suffit,
// contrairement à ai-chat). Best-effort : un titre absent n'est pas une erreur
// bloquante, l'aperçu (E5-04) reste le libellé de repli.

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export async function generateConversationTitle(conversationId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-title', {
      body: { conversation_id: conversationId },
    });
    if (error) {
      logger.warn('ai_title_generation_failed', { message: error.message });
      return null;
    }
    return (data as { title?: string } | null)?.title ?? null;
  } catch (err) {
    logger.warn('ai_title_generation_threw', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
