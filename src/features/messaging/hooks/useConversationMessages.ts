// useConversationMessages — E6-03.
//
// Liste les messages d'une conversation avec pagination infinie vers le haut
// (cursor sur created_at desc). 50 messages par page.
//
// RLS automatique : seuls les messages des conversations dont je suis
// participant sont retournés (policy `messages select if participant`).

import { useInfiniteQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type MessageAttachmentType = 'text' | 'image' | 'voice' | 'video';

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  attachment_type: MessageAttachmentType;
  content: string | null;
  attachment_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export const PAGE_SIZE = 50;

export function conversationMessagesQueryKey(conversationId: string) {
  return ['conversation', conversationId, 'messages'] as const;
}

interface Page {
  messages: MessageRow[];
  nextCursor: string | null;
}

export function useConversationMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: conversationId
      ? conversationMessagesQueryKey(conversationId)
      : ['conversation', 'none'],
    enabled: Boolean(conversationId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (!conversationId) return { messages: [], nextCursor: null };

      let q = supabase
        .from('messages')
        .select(
          'id, conversation_id, sender_id, attachment_type, content, attachment_url, reply_to_id, created_at, edited_at, deleted_at'
        )
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        q = q.lt('created_at', pageParam);
      }

      const { data, error } = await q;
      if (error) {
        logger.warn('useConversationMessages query failed', {
          message: error.message,
          conversationId,
        });
        throw error;
      }

      const messages = (data ?? []) as MessageRow[];
      const last = messages[messages.length - 1];
      const nextCursor: string | null =
        messages.length === PAGE_SIZE && last ? last.created_at : null;

      return { messages, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000,
  });
}
