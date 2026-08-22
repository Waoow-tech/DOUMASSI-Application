// useCreateGroupConversation — Sprint 6, ticket #212.
//
// Wrapper TanStack autour de la RPC `create_group_conversation(name, ids[])`
// livrée Sprint 0 (cf migration 20260602120000_messaging_schema.sql). Retourne
// l'UUID de la conversation créée. Refuse côté RPC si un participant a un
// blocage bilatéral avec moi.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface CreateGroupPayload {
  name: string;
  participantIds: string[];
}

export function useCreateGroupConversation() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateGroupPayload>({
    mutationFn: async ({ name, participantIds }) => {
      const t = getT();
      const trimmed = name.trim();
      if (trimmed.length === 0) throw new Error(t.messaging.errors.groupNameRequired);
      if (trimmed.length > 80) throw new Error(t.messaging.errors.groupNameTooLong);
      if (participantIds.length === 0) throw new Error(t.messaging.errors.participantRequired);

      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_name: trimmed,
        p_participant_ids: participantIds,
      });

      if (error) {
        logger.warn('create_group_conversation failed', { message: error.message });
        throw error;
      }
      if (typeof data !== 'string') {
        throw new Error(t.messaging.errors.invalidRpcResponse);
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'my'] });
    },
  });
}
