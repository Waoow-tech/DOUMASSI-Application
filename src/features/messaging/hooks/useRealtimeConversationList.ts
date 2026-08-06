// useRealtimeConversationList — fix bug messagerie.
//
// PROBLÈME
//   L'écran liste (get_my_conversations) n'avait AUCUN realtime. Quand
//   quelqu'un t'envoyait un message — surtout un PREMIER message (nouvelle
//   conversation) — rien ne rafraîchissait la liste : la conversation
//   n'apparaissait pas tant qu'on ne refetchait pas à la main. On ne pouvait la
//   retrouver qu'en ouvrant le profil de l'expéditeur.
//
// FIX
//   On s'abonne aux INSERT sur `messages`. La RLS s'applique côté serveur
//   (comme pour useRealtimeConversation) : Supabase ne nous diffuse QUE les
//   messages de nos propres conversations — y compris le tout premier message
//   d'une conversation neuve, puisqu'on en est déjà participant. À chaque
//   INSERT, on invalide la liste → elle se refetch, la nouvelle conversation
//   apparaît et remonte en tête, le compteur non-lus se met à jour.
//
//   Invalidation (et non patch du cache) : pour une conversation NEUVE, on n'a
//   pas encore la ligne enrichie (nom, avatar…) côté client ; seul un refetch
//   de get_my_conversations la construit.

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { myConversationsQueryKey } from './useMyConversations';

export function useRealtimeConversationList() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: myConversationsQueryKey });
    };

    const channel = supabase
      .channel('conversation-list')
      // Nouveau message dans une de MES conversations (RLS-filtré serveur) →
      // la liste doit se rafraîchir (nouvelle conv, réordonnancement, non-lus).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, invalidate)
      // Édition / suppression d'un message → le preview de la liste peut changer.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, invalidate)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Realtime liste conversations dégradé', { status });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
