// useIncomingCallListener — Ticket #233 (E6-C4).
//
// Subscribe via Supabase Realtime à la table `calls` pour détecter en temps
// réel les INSERT de calls où je suis destinataire (= je suis participant de
// la conversation MAIS je ne suis pas l'initiator).
//
// Quand un incoming call arrive, on push vers l'écran ringtone
// `/call/incoming/[id]` qui propose Accept/Decline.
//
// LIMITES MVP :
//   - Foreground uniquement : si l'app est killed/background, on ne capte
//     pas l'INSERT Realtime. Pour un vrai "appel entrant qui sonne même
//     killed", il faut un push notif spécial + service natif (CallKit iOS /
//     ConnectionService Android) — chantier V2 noté dans le ticket.
//   - On filtre côté client après réception : on subscribe à TOUS les calls
//     INSERT (pour éviter de gérer dynamiquement les filtres par convId), et
//     on filtre par `initiator_id !== me`. La RLS côté DB garantit qu'on ne
//     reçoit que les calls de nos conversations.

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface CallRow {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  daily_room_url: string;
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'cancelled';
}

export function useIncomingCallListener(meId: string | null) {
  // Garde contre les double-déclenchements (Realtime peut renvoyer la même
  // row en cas de reconnexion).
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!meId) return undefined;

    const channel = supabase
      .channel('incoming-calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, (payload) => {
        const row = payload.new as CallRow | undefined;
        if (!row) return;
        // Filtre client : ce n'est PAS moi qui ai lancé l'appel ET le call
        // est encore en ringing (pas un INSERT historique de Realtime replay).
        if (row.initiator_id === meId) return;
        if (row.status !== 'ringing') return;
        if (handledRef.current.has(row.id)) return;
        handledRef.current.add(row.id);

        logger.info('Incoming call received', {
          call_id: row.id,
          call_type: row.call_type,
          from: row.initiator_id,
        });

        router.push({
          pathname: '/call/incoming/[id]',
          params: {
            id: row.id,
            conversationId: row.conversation_id,
            callType: row.call_type,
            roomUrl: row.daily_room_url,
          },
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.warn('Incoming call channel error');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId]);
}
