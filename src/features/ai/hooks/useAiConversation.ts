// Chargement d'une conversation IA + création à la demande — E5-03.
//
// L'historique multi-conversations (drawer) est le ticket E5-04 : ici on gère
// UNE conversation, celle affichée à l'écran. Elle est créée paresseusement au
// premier message pour ne pas remplir la base de conversations vides.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function aiMessagesKey(conversationId: string | null) {
  return ['ai', 'messages', conversationId] as const;
}

/**
 * Messages d'une conversation, ordre chronologique.
 * Désactivé tant qu'aucune conversation n'existe (premier écran vierge).
 */
export function useAiMessages(conversationId: string | null) {
  return useQuery({
    queryKey: aiMessagesKey(conversationId),
    enabled: conversationId !== null,
    queryFn: async (): Promise<AiMessage[]> => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('ai_messages_fetch_failed', { message: error.message });
        throw error;
      }
      // Les messages 'system' ne sont pas affichés : ils n'existent qu'à
      // l'intérieur de l'Edge Function, jamais persistés. On filtre par sûreté.
      return ((data ?? []) as AiMessage[]).filter((m) => m.role !== 'system');
    },
  });
}

/**
 * Crée une conversation vide et renvoie son id. `user_id` est posé par défaut
 * à `auth.uid()` côté base ; la policy `ai_conv_insert_own` garantit qu'on ne
 * peut créer que pour soi.
 */
export function useCreateAiConversation() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({})
        .select('id')
        .single();

      if (error) {
        logger.warn('ai_conversation_create_failed', { message: error.message });
        throw error;
      }
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      // E5-04 (drawer) écoutera cette clé.
      void queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
  });
}
