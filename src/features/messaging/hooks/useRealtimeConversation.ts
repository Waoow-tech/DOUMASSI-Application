// useRealtimeConversation — E6-04.
//
// Souscrit au channel Supabase Realtime (postgres_changes) sur public.messages
// filtré par conversation_id. Synchronise le cache TanStack Query en conséquence :
//
//   INSERT → prépend le message en tête de la 1ère page (liste inversée : index 0 = plus récent).
//            Dédoublonnage si useSendMessage a déjà injecté ce message via update optimiste.
//   UPDATE → remplace le message dans toutes les pages
//            (édition content/edited_at ou soft-delete deleted_at).
//
// La RLS messages (select if participant) s'applique côté serveur :
// Supabase ne diffuse que les lignes que le JWT de l'utilisateur a le droit de lire.
// Pas besoin de filtre user_id supplémentaire côté client.
//
// Reconnexion automatique gérée par Supabase JS.
// Si SUBSCRIBED pas reçu sous 10s → isRealtimeDown = true → bannière dégradée dans l'écran.

import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { conversationMessagesQueryKey, type MessageRow } from './useConversationMessages';

type Page = { messages: MessageRow[]; nextCursor: string | null };

const REALTIME_TIMEOUT_MS = 10_000;

export function useRealtimeConversation(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [isRealtimeDown, setIsRealtimeDown] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Drapeau de nettoyage : empêche les callbacks asynchrones (CLOSED, TIMED_OUT) de setter
    // l'état après que le cleanup ait tourné. Sans ce flag, quand conversationId change,
    // removeChannel() déclenche un callback CLOSED *après* que le nouvel effet ait déjà
    // appelé setIsRealtimeDown(false), l'écrasant par true.
    let cancelled = false;

    setIsRealtimeDown(false);

    // Bannière dégradée si la connexion Realtime n'est pas établie dans les 10s
    timeoutRef.current = setTimeout(() => {
      if (!cancelled) setIsRealtimeDown(true);
    }, REALTIME_TIMEOUT_MS);

    const channel = supabase
      .channel(`conv-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          queryClient.setQueryData<InfiniteData<Page>>(
            conversationMessagesQueryKey(conversationId),
            (old) => {
              if (!old?.pages[0]) return old;
              // Dédoublonnage : useSendMessage peut avoir déjà injecté ce message
              const isDuplicate = old.pages.some((page) =>
                page.messages.some((m) => m.id === newMsg.id)
              );
              if (isDuplicate) return old;
              const [firstPage, ...rest] = old.pages;
              return {
                ...old,
                pages: [{ ...firstPage, messages: [newMsg, ...firstPage.messages] }, ...rest],
              };
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as MessageRow;
          queryClient.setQueryData<InfiniteData<Page>>(
            conversationMessagesQueryKey(conversationId),
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
                })),
              };
            }
          );
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setIsRealtimeDown(false);
          logger.info('Realtime messages connecté', { conversationId });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          logger.warn('Realtime messages dégradé', { status, conversationId });
          setIsRealtimeDown(true);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return { isRealtimeDown };
}
