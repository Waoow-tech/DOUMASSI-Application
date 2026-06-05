import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type ConversationListRow = {
  conversation_id: string;
  is_group: boolean;
  display_name: string;
  display_avatar_url: string | null;
  other_user_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  muted: boolean;
};

export const myConversationsQueryKey = ['conversations', 'my'] as const;

function mapConversationRow(row: Record<string, unknown>): ConversationListRow {
  const unreadCount = Number(row.unread_count ?? 0);

  return {
    conversation_id: String(row.conversation_id ?? ''),
    is_group: row.is_group === true,
    display_name: String(row.display_name ?? '?'),
    display_avatar_url: (row.display_avatar_url as string | null) ?? null,
    other_user_id: (row.other_user_id as string | null) ?? null,
    last_message_at: String(row.last_message_at ?? ''),
    last_message_preview: (row.last_message_preview as string | null) ?? null,
    last_message_sender_id: (row.last_message_sender_id as string | null) ?? null,
    unread_count: Number.isFinite(unreadCount) ? unreadCount : 0,
    muted: row.muted === true,
  };
}

export function useMyConversations() {
  return useQuery({
    queryKey: myConversationsQueryKey,
    queryFn: async (): Promise<ConversationListRow[]> => {
      const { data, error } = await supabase.rpc('get_my_conversations');

      if (error) {
        logger.warn('get_my_conversations failed', { message: error.message });
        throw error;
      }

      return ((data ?? []) as Record<string, unknown>[]).map(mapConversationRow);
    },
    staleTime: 15_000,
  });
}
