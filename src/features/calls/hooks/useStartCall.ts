// useStartCall — Ticket #231 (E6-C2).
//
// Mutation TanStack qui invoque l'Edge Function `create-daily-call`. La
// fonction crée une room Daily.co + INSERT dans `public.calls` + retourne
// `{ call_id, room_url, token }` pour que le client puisse JOIN la room.
//
// Le caller est responsable de naviguer vers `/call/[id]` avec les params
// `room_url` et `token` après la réussite de la mutation.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type CallType = 'audio' | 'video';

export interface StartCallPayload {
  conversationId: string;
  callType: CallType;
}

export interface StartCallResult {
  callId: string;
  roomUrl: string;
  token: string;
}

export function useStartCall() {
  return useMutation<StartCallResult, Error, StartCallPayload>({
    mutationFn: async ({ conversationId, callType }) => {
      const { data, error } = await supabase.functions.invoke<{
        call_id: string;
        room_url: string;
        token: string;
      }>('create-daily-call', {
        body: { conversation_id: conversationId, call_type: callType },
      });

      if (error) {
        logger.warn('useStartCall invoke failed', { message: error.message });
        throw error;
      }
      if (!data?.call_id || !data?.room_url || !data?.token) {
        throw new Error('Réponse Edge Function invalide');
      }

      return {
        callId: data.call_id,
        roomUrl: data.room_url,
        token: data.token,
      };
    },
  });
}
