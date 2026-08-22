// useConversationHeader — E6-03.
//
// Récupère les infos de l'header pour une conversation : l'autre user (DM)
// ou le nom du groupe. Pour la bêta, on n'affiche que les DM 1-to-1, donc
// l'header montre l'avatar + username de l'autre participant.

import { useQuery } from '@tanstack/react-query';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ConversationHeader {
  conversation_id: string;
  is_group: boolean;
  display_name: string;
  display_avatar_url: string | null;
  display_is_verified: boolean;
  other_user_id: string | null;
}

export function useConversationHeader(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId, 'header'],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<ConversationHeader | null> => {
      const t = getT();
      if (!conversationId) return null;

      // 1. Récupère la conversation pour savoir si c'est un groupe
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id, is_group, name')
        .eq('id', conversationId)
        .maybeSingle();
      if (convError) {
        logger.warn('useConversationHeader conv error', { message: convError.message });
        throw convError;
      }
      if (!conv) return null;

      // 2. Récupère ma session pour exclure moi-même
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) throw sessionError ?? new Error('no session');
      const meId = session.session.user.id;

      if (conv.is_group) {
        return {
          conversation_id: conversationId,
          is_group: true,
          display_name: conv.name ?? '?',
          display_avatar_url: null,
          display_is_verified: false,
          other_user_id: null,
        };
      }

      // 3. DM : récupère l'autre participant + son profile
      const { data: others, error: othersError } = await supabase
        .from('conversation_participants')
        .select('user_id, profiles!inner(username, avatar_url, is_verified)')
        .eq('conversation_id', conversationId)
        .neq('user_id', meId)
        .limit(1);
      if (othersError) {
        logger.warn('useConversationHeader other error', { message: othersError.message });
        throw othersError;
      }

      const other = (others ?? [])[0] as
        | {
            user_id: string;
            profiles: {
              username: string;
              avatar_url: string | null;
              is_verified: boolean;
            };
          }
        | undefined;

      if (!other) {
        // Cas dégradé : conv DM sans autre participant (rare, peut arriver si
        // l'autre user a supprimé son compte et a été retiré par cascade)
        return {
          conversation_id: conversationId,
          is_group: false,
          display_name: t.messaging.deletedAccount,
          display_avatar_url: null,
          display_is_verified: false,
          other_user_id: null,
        };
      }

      return {
        conversation_id: conversationId,
        is_group: false,
        display_name: other.profiles.username,
        display_avatar_url: other.profiles.avatar_url,
        display_is_verified: other.profiles.is_verified,
        other_user_id: other.user_id,
      };
    },
    staleTime: 60_000,
  });
}
