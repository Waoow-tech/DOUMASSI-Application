// useMessageActions — E6-03.
//
// Actions sur les messages : édition (UPDATE content + edited_at), soft-delete
// (UPDATE deleted_at), et marquage lu de la conversation (UPDATE
// conversation_participants.last_read_at).
//
// RLS :
//   - messages update own : seul le sender peut UPDATE (couvre edit + delete)
//   - conversation_participants update own last_read_at : seul moi peux UPDATE
//
// Optimistic updates côté cache pour fluidité immédiate.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { conversationMessagesQueryKey, type MessageRow } from './useConversationMessages';

type MessagePage = {
  messages: MessageRow[];
  nextCursor: string | null;
};

// ---------------------------------------------------------------------------
// useDeleteMessage — soft-delete d'un message qu'on a envoyé
// ---------------------------------------------------------------------------
export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) {
        logger.warn('useDeleteMessage failed', { message: error.message, messageId });
        throw error;
      }
    },

    onMutate: async (messageId) => {
      await queryClient.cancelQueries({
        queryKey: conversationMessagesQueryKey(conversationId),
      });
      const previous = queryClient.getQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(conversationId));

      queryClient.setQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(conversationId), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
            ),
          })),
        };
      });

      return { previous };
    },

    onError: (_err, _msgId, context) => {
      const ctx = context as
        | { previous?: { pages: MessagePage[]; pageParams: unknown[] } }
        | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(conversationMessagesQueryKey(conversationId), ctx.previous);
      }
    },

    onSettled: () => {
      // Le trigger fn_recalc_conversation_last_message_on_delete a mis à jour
      // conversations.last_message_preview si on a supprimé le dernier message.
      // On invalide la liste pour le refléter.
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'my'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useEditMessage — édition du contenu (content + edited_at)
// ---------------------------------------------------------------------------
export interface EditMessagePayload {
  messageId: string;
  newContent: string;
}

const MAX_CONTENT_LENGTH = 4000;

export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, EditMessagePayload>({
    mutationFn: async ({ messageId, newContent }) => {
      const trimmed = newContent.trim();
      if (trimmed.length === 0) throw new Error('Contenu vide');
      if (trimmed.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Message trop long (max ${MAX_CONTENT_LENGTH} caractères)`);
      }

      const { error } = await supabase
        .from('messages')
        .update({ content: trimmed, edited_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) {
        logger.warn('useEditMessage failed', { message: error.message, messageId });
        throw error;
      }
    },

    onMutate: async ({ messageId, newContent }) => {
      await queryClient.cancelQueries({
        queryKey: conversationMessagesQueryKey(conversationId),
      });
      const previous = queryClient.getQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(conversationId));

      queryClient.setQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(conversationId), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === messageId
                ? { ...m, content: newContent.trim(), edited_at: new Date().toISOString() }
                : m
            ),
          })),
        };
      });

      return { previous };
    },

    onError: (_err, _payload, context) => {
      const ctx = context as
        | { previous?: { pages: MessagePage[]; pageParams: unknown[] } }
        | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(conversationMessagesQueryKey(conversationId), ctx.previous);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useMarkConversationRead — UPDATE last_read_at = now() pour moi
// ---------------------------------------------------------------------------
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (conversationId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { error } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', session.session.user.id);

      if (error) {
        logger.warn('useMarkConversationRead failed', {
          message: error.message,
          conversationId,
        });
        // On n'rethrow pas : un échec de mark-read ne doit pas bloquer la lecture
      }
    },

    onSuccess: () => {
      // Réduit le badge non-lu sur la liste des conv
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'my'] });
    },
  });
}
