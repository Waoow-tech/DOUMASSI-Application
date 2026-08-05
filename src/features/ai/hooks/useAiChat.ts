// Orchestration d'un tour de chat IA — E5-03.
//
// Assemble : création paresseuse de la conversation, affichage optimiste du
// message utilisateur, ouverture du flux SSE, accumulation des fragments dans
// une bulle assistant « en cours », puis rafraîchissement depuis la base.
//
// RÉPARTITION DES RESPONSABILITÉS (important)
//   L'Edge Function `ai-chat` persiste ELLE-MÊME les deux messages (user +
//   assistant). Le client ne fait donc AUCUN insert : il affiche en optimiste,
//   streame, puis invalide le cache pour retomber sur la vérité de la base.
//   Écrire aussi côté client créerait des doublons.

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { generateConversationTitle } from '../lib/generateTitle';
import { type PendingTurn } from '../lib/mergeMessages';
import { AiChatError, streamAiChat } from '../lib/streamAiChat';

import {
  aiConversationsKey,
  aiMessagesKey,
  useCreateAiConversation,
  type AiChatMode,
} from './useAiConversation';

export type { PendingTurn } from '../lib/mergeMessages';
export { mergeMessages } from '../lib/mergeMessages';

export interface UseAiChatResult {
  send: (content: string, conversationId: string | null) => Promise<void>;
  /** Tour en cours, ou null si aucune requête active. */
  pending: PendingTurn | null;
  isStreaming: boolean;
  error: AiChatError | null;
  clearError: () => void;
  /** Id de conversation courant (créé au 1er message si besoin). */
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  /** Mode Learning (E5-08). Persisté dans ai_conversations.category. */
  mode: AiChatMode;
  setMode: (mode: AiChatMode) => void;
}

export function useAiChat(initialConversationId: string | null): UseAiChatResult {
  const queryClient = useQueryClient();
  const createConversation = useCreateAiConversation();

  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<AiChatError | null>(null);
  const [mode, setModeState] = useState<AiChatMode>('general');

  const abortRef = useRef<AbortController | null>(null);

  // Annule un flux en cours si l'écran se démonte : pas de setState sur un
  // composant démonté, pas de requête réseau zombie.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Quand on ouvre une conversation existante (depuis le drawer), on charge son
  // mode depuis la base pour que le badge Learning reflète la réalité. Pour une
  // conversation qu'on vient de créer, la base renvoie le mode qu'on y a posé →
  // pas de conflit.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    void supabase
      .from('ai_conversations')
      .select('category')
      .eq('id', conversationId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const category = (data as { category?: string } | null)?.category;
        setModeState(category === 'learning' ? 'learning' : 'general');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Bascule de mode. Sur une conversation existante, on persiste tout de suite
  // (le serveur lit category au prochain message). Sinon, l'état local suffit :
  // la catégorie sera posée à la création, au 1er message.
  const setMode = useCallback(
    (next: AiChatMode) => {
      setModeState(next);
      const id = conversationId;
      if (!id) return;
      void supabase
        .from('ai_conversations')
        .update({ category: next })
        .eq('id', id)
        .then(({ error: updateError }) => {
          if (updateError) {
            logger.warn('ai_set_mode_failed', { message: updateError.message });
          }
        });
    },
    [conversationId]
  );

  const clearError = useCallback(() => setError(null), []);

  const send = useCallback(
    async (content: string, activeConversationId: string | null) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setPending({ userContent: trimmed, assistantContent: '', isWaitingFirstChunk: true });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Conversation créée au tout premier message seulement.
        let convId = activeConversationId ?? conversationId;
        const isNewConversation = !convId;
        if (!convId) {
          // La catégorie fixe le mode (Learning) dès la création, pour que le
          // serveur applique le bon prompt système au tout premier message.
          convId = await createConversation.mutateAsync({ category: mode });
          setConversationId(convId);
        }

        let assistant = '';
        await streamAiChat({
          conversationId: convId,
          content: trimmed,
          signal: controller.signal,
          onDelta: (delta) => {
            assistant += delta;
            setPending({
              userContent: trimmed,
              assistantContent: assistant,
              isWaitingFirstChunk: false,
            });
          },
          onDone: () => {
            // La base fait foi : on la relit, ce qui remplace le tour optimiste
            // par les vraies lignes (avec leurs id et timestamps).
            void queryClient.invalidateQueries({ queryKey: aiMessagesKey(convId) });
          },
        });

        // Titre auto (E5-05) après le PREMIER échange d'une conversation neuve.
        // Best-effort et non bloquant : on ne fait pas attendre l'utilisateur
        // pour un titre. Au retour, on rafraîchit la liste du drawer.
        if (isNewConversation) {
          const titleConvId = convId;
          void generateConversationTitle(titleConvId).then((title) => {
            if (title) void queryClient.invalidateQueries({ queryKey: aiConversationsKey });
          });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // Démontage / annulation : on ne montre pas d'erreur.
          return;
        }
        const chatError =
          err instanceof AiChatError
            ? err
            : new AiChatError('unknown', err instanceof Error ? err.message : String(err));
        logger.warn('ai_chat_turn_failed', { kind: chatError.kind, message: chatError.message });
        setError(chatError);
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false);
          setPending(null);
        }
        abortRef.current = null;
      }
    },
    [conversationId, createConversation, isStreaming, mode, queryClient]
  );

  return {
    send,
    pending,
    isStreaming,
    error,
    clearError,
    conversationId,
    setConversationId,
    mode,
    setMode,
  };
}

/** Message de l'erreur IA, traduit et prêt à afficher. */
export function aiErrorMessage(error: AiChatError): string {
  const t = getT().ai.errors;
  switch (error.kind) {
    case 'quota':
      return t.quota(error.quota ?? 0);
    case 'auth':
      return t.auth;
    case 'provider':
      return t.provider;
    case 'network':
      return t.network;
    default:
      return t.generic;
  }
}
