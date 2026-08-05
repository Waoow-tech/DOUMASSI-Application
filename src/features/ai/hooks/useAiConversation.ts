// Chargement d'une conversation IA + création à la demande — E5-03,
// étendu à la liste multi-conversations par E5-04.
//
// `useAiMessages` / `useCreateAiConversation` gèrent LA conversation affichée.
// `useAiConversations` / `useDeleteAiConversation` alimentent le drawer.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

/** Entrée de la liste du drawer (E5-04). */
export interface AiConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
  /** 1er message utilisateur — sert de libellé tant que `title` est null. */
  preview: string | null;
}

export const aiConversationsKey = ['ai', 'conversations'] as const;

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
      void queryClient.invalidateQueries({ queryKey: aiConversationsKey });
    },
  });
}

/**
 * Liste des conversations de l'utilisateur (drawer E5-04), plus récente d'abord.
 * S'appuie sur la RPC `get_ai_conversations` (aperçu + compteur en une requête).
 */
export function useAiConversations() {
  return useQuery({
    queryKey: aiConversationsKey,
    queryFn: async (): Promise<AiConversationSummary[]> => {
      const { data, error } = await supabase.rpc('get_ai_conversations');
      if (error) {
        logger.warn('ai_conversations_fetch_failed', { message: error.message });
        throw error;
      }
      return (data ?? []) as AiConversationSummary[];
    },
  });
}

/** Supprime une conversation (cascade sur ses messages via la FK). */
export function useDeleteAiConversation() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: async (conversationId) => {
      const { error } = await supabase.from('ai_conversations').delete().eq('id', conversationId);

      if (error) {
        logger.warn('ai_conversation_delete_failed', { message: error.message });
        throw error;
      }
      return conversationId;
    },
    onSuccess: (conversationId) => {
      void queryClient.invalidateQueries({ queryKey: aiConversationsKey });
      queryClient.removeQueries({ queryKey: aiMessagesKey(conversationId) });
    },
  });
}
