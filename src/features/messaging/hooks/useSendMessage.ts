// useSendMessage — E6-05.
//
// Mutation pour envoyer un message texte dans une conversation, avec
// optimistic update. La bulle apparaît immédiatement (status pending), puis
// est remplacée par la vraie au retour serveur (via Realtime ou refetch).
// En cas d'échec, la bulle passe en status 'failed' et un retry est possible.
//
// Triggers DB côté Postgres :
//   - trg_update_conversation_last_message : met à jour conversations.last_message_*
//   - trg_notify_message : crée une notification pour l'autre participant
// Aucune action manuelle requise.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { uuidv4 } from '@/lib/uuid';

import { conversationMessagesQueryKey, type MessageRow } from './useConversationMessages';

const MAX_CONTENT_LENGTH = 4000;

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  /**
   * ID temporaire généré côté client. Sert à matcher la bulle optimistic
   * avec celle qui revient via Realtime.
   */
  clientTempId?: string;
}

interface OptimisticContext {
  conversationId: string;
  clientTempId: string;
}

type MessagePage = {
  messages: MessageRow[];
  nextCursor: string | null;
};

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<MessageRow, Error, SendMessagePayload, OptimisticContext>({
    mutationFn: async ({ conversationId, content }) => {
      const trimmed = content.trim();
      if (trimmed.length === 0) throw new Error('Message vide');
      if (trimmed.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Message trop long (max ${MAX_CONTENT_LENGTH} caractères)`);
      }

      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        throw new Error('Session expirée. Reconnectez-vous.');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: session.session.user.id,
          attachment_type: 'text',
          content: trimmed,
        })
        .select(
          'id, conversation_id, sender_id, attachment_type, content, attachment_url, reply_to_id, created_at, edited_at, deleted_at'
        )
        .single();

      if (error) {
        logger.warn('useSendMessage insert failed', {
          message: error.message,
          conversationId,
        });
        throw error;
      }
      return data as MessageRow;
    },

    onMutate: async ({ conversationId, content, clientTempId }) => {
      const tempId = clientTempId ?? `temp-${uuidv4()}`;

      // Annule les fetchs en cours pour éviter qu'ils écrasent l'optimistic
      await queryClient.cancelQueries({
        queryKey: conversationMessagesQueryKey(conversationId),
      });

      // Ajoute la bulle optimistic en tête de la 1re page (la plus récente)
      const { data: session } = await supabase.auth.getSession();
      const meId = session.session?.user.id;

      const optimisticMsg: MessageRow = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: meId ?? 'unknown',
        attachment_type: 'text',
        content: content.trim(),
        attachment_url: null,
        reply_to_id: null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
      };

      queryClient.setQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(conversationId), (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ messages: [optimisticMsg], nextCursor: null as string | null }],
            pageParams: [null],
          };
        }
        const firstPage = old.pages[0] ?? { messages: [], nextCursor: null as string | null };
        const rest = old.pages.slice(1);
        return {
          ...old,
          pages: [
            {
              messages: [optimisticMsg, ...firstPage.messages],
              nextCursor: firstPage.nextCursor,
            },
            ...rest,
          ],
        };
      });

      return { conversationId, clientTempId: tempId };
    },

    onError: (_err, vars, context) => {
      // On marque la bulle temp en `failed` plutôt que de la retirer, pour
      // permettre un retry depuis l'UI.
      if (!context) return;
      queryClient.setQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(vars.conversationId), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === context.clientTempId
                ? {
                    ...m,
                    // Marqueur visuel pour l'UI : on encode l'erreur dans le content
                    // (alternative : étendre MessageRow avec status, mais on garde
                    // light pour la bêta)
                    id: `failed-${context.clientTempId}`,
                  }
                : m
            ),
          })),
        };
      });
    },

    onSuccess: (serverMessage, vars, context) => {
      if (!context) return;
      // Remplace la bulle temp par la vraie (matching par id temp)
      queryClient.setQueryData<{
        pages: MessagePage[];
        pageParams: unknown[];
      }>(conversationMessagesQueryKey(vars.conversationId), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === context.clientTempId ? serverMessage : m)),
          })),
        };
      });

      // Invalide la liste des conversations pour mettre à jour last_message
      // (le trigger DB l'a fait côté Postgres, mais le cache client ne le sait pas)
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'my'] });
    },
  });
}
