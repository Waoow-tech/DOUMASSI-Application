// useConversationCalls — Ticket #234 (E6-C5).
//
// Récupère les appels HISTORIQUES (status != ringing/accepted) d'une
// conversation pour les afficher comme des "entrées" discrètes dans la
// timeline messages.
//
// On filtre côté DB (`neq('status', 'ringing')`) pour éviter de fetcher les
// appels en cours — ceux-là sont gérés par useIncomingCallListener.

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type CallFinalStatus = 'rejected' | 'missed' | 'ended' | 'cancelled';

export interface CallEntryRow {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  status: CallFinalStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export function conversationCallsQueryKey(conversationId: string) {
  return ['conversation', conversationId, 'calls'] as const;
}

export function useConversationCalls(conversationId: string | null) {
  const query = useQuery({
    queryKey: conversationId
      ? conversationCallsQueryKey(conversationId)
      : ['conversation', 'none', 'calls'],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<CallEntryRow[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('calls')
        .select(
          'id, conversation_id, initiator_id, call_type, status, created_at, started_at, ended_at'
        )
        .eq('conversation_id', conversationId)
        .in('status', ['rejected', 'missed', 'ended', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.warn('useConversationCalls failed', {
          message: error.message,
          conversationId,
        });
        throw error;
      }
      return (data ?? []) as CallEntryRow[];
    },
    staleTime: 30_000,
  });

  return useMemo(
    () => ({
      calls: query.data ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    }),
    [query.data, query.isError, query.isLoading, query.refetch]
  );
}
