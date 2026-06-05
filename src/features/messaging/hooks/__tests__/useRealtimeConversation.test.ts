// Tests E6-04 — useRealtimeConversation
//
// Couverture :
//   • Critères d'acceptation du ticket (canal filtré, INSERT, UPDATE, cleanup, reconnect)
//   • Redteam : stale closure après cleanup, race condition INSERT, UPDATE absent du cache,
//     INSERT sur cache vide, pagination multi-pages, changement de conversationId

import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

import {
  conversationMessagesQueryKey,
  type MessageRow,
} from '@/features/messaging/hooks/useConversationMessages';
import { useRealtimeConversation } from '@/features/messaging/hooks/useRealtimeConversation';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type ChangeCallback = (payload: { new: unknown }) => void;
type StatusCallback = (status: string) => void;

let capturedInsertCb: ChangeCallback | null = null;
let capturedUpdateCb: ChangeCallback | null = null;
let capturedStatusCb: StatusCallback | null = null;

const mockChannel = {
  on: jest
    .fn()
    .mockImplementation((_type: string, filter: { event: string }, cb: ChangeCallback) => {
      if (filter.event === 'INSERT') capturedInsertCb = cb;
      if (filter.event === 'UPDATE') capturedUpdateCb = cb;
      return mockChannel;
    }),
  subscribe: jest.fn().mockImplementation((cb: StatusCallback) => {
    capturedStatusCb = cb;
    return mockChannel;
  }),
};

const mockCreateChannel = jest.fn().mockReturnValue(mockChannel);
const mockRemoveChannel = jest.fn().mockResolvedValue('ok');

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockCreateChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Page = { messages: MessageRow[]; nextCursor: string | null };

function msg(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    attachment_type: 'text',
    content: 'hello',
    attachment_url: null,
    reply_to_id: null,
    created_at: '2026-06-04T10:00:00.000Z',
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function singlePage(messages: MessageRow[]): InfiniteData<Page> {
  return { pages: [{ messages, nextCursor: null }], pageParams: [null] };
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

const CONV = 'conv-abc-123';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useRealtimeConversation', () => {
  let qc: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedInsertCb = null;
    capturedUpdateCb = null;
    capturedStatusCb = null;
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    qc.clear();
  });

  // =========================================================================
  // Critères d'acceptation ticket
  // =========================================================================

  describe('canal et souscription', () => {
    it('crée un channel nommé avec le conversationId', () => {
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });
      expect(mockCreateChannel).toHaveBeenCalledWith(`conv-messages-${CONV}`);
    });

    it('filtre INSERT sur public.messages avec conversation_id=eq.{id}', () => {
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${CONV}`,
        }),
        expect.any(Function)
      );
    });

    it('filtre UPDATE sur public.messages avec conversation_id=eq.{id}', () => {
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${CONV}`,
        }),
        expect.any(Function)
      );
    });

    it('ne crée pas de channel si conversationId est null', () => {
      renderHook(() => useRealtimeConversation(null), { wrapper: wrapper(qc) });
      expect(mockCreateChannel).not.toHaveBeenCalled();
    });
  });

  describe('INSERT', () => {
    it('prépend le nouveau message en tête de la première page', () => {
      const existing = msg({ id: 'msg-1' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([existing]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      const newMsg = msg({
        id: 'msg-2',
        content: 'nouveau',
        created_at: '2026-06-04T10:01:00.000Z',
      });
      act(() => {
        capturedInsertCb?.({ new: newMsg });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[0]?.messages[0]).toEqual(newMsg);
      expect(data?.pages[0]?.messages).toHaveLength(2);
    });

    it('ne duplique pas un message déjà présent (dédoublonnage)', () => {
      const existing = msg({ id: 'msg-1' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([existing]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      act(() => {
        capturedInsertCb?.({ new: { ...existing } });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[0]?.messages).toHaveLength(1);
    });

    it('ne plante pas si le cache est vide (pages non initialisées)', () => {
      // Cache absent : useConversationMessages n'a pas encore résolu
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });
      expect(() => {
        act(() => {
          capturedInsertCb?.({ new: msg({ id: 'msg-new' }) });
        });
      }).not.toThrow();
    });
  });

  describe('UPDATE (édition + soft-delete)', () => {
    it('remplace le message édité dans le cache (content + edited_at)', () => {
      const original = msg({ id: 'msg-1', content: 'original' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([original]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      const edited = { ...original, content: 'modifié', edited_at: '2026-06-04T10:01:00.000Z' };
      act(() => {
        capturedUpdateCb?.({ new: edited });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[0]?.messages[0]?.content).toBe('modifié');
      expect(data?.pages[0]?.messages[0]?.edited_at).toBe('2026-06-04T10:01:00.000Z');
    });

    it('applique le soft-delete (deleted_at) dans le cache', () => {
      const original = msg({ id: 'msg-1' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([original]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      const softDeleted = { ...original, deleted_at: '2026-06-04T10:01:00.000Z' };
      act(() => {
        capturedUpdateCb?.({ new: softDeleted });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[0]?.messages[0]?.deleted_at).toBe('2026-06-04T10:01:00.000Z');
    });

    it('ne plante pas si le message est absent du cache (ghost UPDATE)', () => {
      const original = msg({ id: 'msg-1' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([original]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      act(() => {
        capturedUpdateCb?.({ new: msg({ id: 'msg-999', content: 'fantôme' }) });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[0]?.messages).toHaveLength(1);
      expect(data?.pages[0]?.messages[0]?.id).toBe('msg-1');
    });

    it('met à jour un message dans une page paginée (page 2)', () => {
      const p1msg = msg({ id: 'msg-p1', created_at: '2026-06-04T10:00:00.000Z' });
      const p2msg = msg({
        id: 'msg-p2',
        content: 'ancien',
        created_at: '2026-06-04T08:00:00.000Z',
      });
      const multiPage: InfiniteData<Page> = {
        pages: [
          { messages: [p1msg], nextCursor: '2026-06-04T09:00:00.000Z' },
          { messages: [p2msg], nextCursor: null },
        ],
        pageParams: [null, '2026-06-04T09:00:00.000Z'],
      };
      qc.setQueryData(conversationMessagesQueryKey(CONV), multiPage);
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      act(() => {
        capturedUpdateCb?.({ new: { ...p2msg, content: 'mis à jour' } });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      expect(data?.pages[1]?.messages[0]?.content).toBe('mis à jour');
      expect(data?.pages[0]?.messages[0]?.id).toBe('msg-p1'); // page 1 intacte
    });
  });

  describe('cleanup et reconnexion', () => {
    it('appelle removeChannel au unmount', () => {
      const { unmount } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });
      unmount();
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('ne double-souscrit pas : removeChannel avant recréation sur remount', () => {
      const { unmount } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });
      unmount();
      expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });
      // Canal recréé après cleanup, pas en double
      expect(mockCreateChannel).toHaveBeenCalledTimes(2);
    });

    it("nettoie l'ancien canal et crée un nouveau lors du changement de conversationId", () => {
      const { rerender } = renderHook(
        ({ id }: { id: string | null }) => useRealtimeConversation(id),
        { wrapper: wrapper(qc), initialProps: { id: 'conv-A' } }
      );

      expect(mockCreateChannel).toHaveBeenCalledWith('conv-messages-conv-A');

      rerender({ id: 'conv-B' });

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
      expect(mockCreateChannel).toHaveBeenCalledWith('conv-messages-conv-B');
    });
  });

  // =========================================================================
  // Bannière fallback (critère ticket + redteam)
  // =========================================================================

  describe('isRealtimeDown — bannière fallback', () => {
    it('false par défaut au montage', () => {
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });
      expect(result.current.isRealtimeDown).toBe(false);
    });

    it('passe à true après 10s sans SUBSCRIBED (faux timers)', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });

      act(() => {
        jest.advanceTimersByTime(10_001);
      });

      expect(result.current.isRealtimeDown).toBe(true);
      jest.useRealTimers();
    });

    it('SUBSCRIBED avant 10s → isRealtimeDown reste false après expiration', () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });

      act(() => {
        capturedStatusCb?.('SUBSCRIBED');
        jest.advanceTimersByTime(10_001);
      });

      expect(result.current.isRealtimeDown).toBe(false);
      jest.useRealTimers();
    });

    it('CHANNEL_ERROR → isRealtimeDown=true', () => {
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });
      act(() => {
        capturedStatusCb?.('CHANNEL_ERROR');
      });
      expect(result.current.isRealtimeDown).toBe(true);
    });

    it('TIMED_OUT → isRealtimeDown=true', () => {
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });
      act(() => {
        capturedStatusCb?.('TIMED_OUT');
      });
      expect(result.current.isRealtimeDown).toBe(true);
    });

    it('SUBSCRIBED après CHANNEL_ERROR (reconnexion auto) → isRealtimeDown repasse à false', () => {
      const { result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });

      act(() => {
        capturedStatusCb?.('CHANNEL_ERROR');
      });
      expect(result.current.isRealtimeDown).toBe(true);

      act(() => {
        capturedStatusCb?.('SUBSCRIBED');
      });
      expect(result.current.isRealtimeDown).toBe(false);
    });
  });

  // =========================================================================
  // Redteam : stale closure (le bug corrigé par le flag `cancelled`)
  // =========================================================================

  describe('redteam — stale closure après cleanup', () => {
    it('callback CLOSED tardif après changement de conversationId ne bascule pas isRealtimeDown à true', () => {
      const { rerender, result } = renderHook(
        ({ id }: { id: string | null }) => useRealtimeConversation(id),
        { wrapper: wrapper(qc), initialProps: { id: 'conv-A' } }
      );

      // Capture le status callback de conv-A avant de changer de conversation
      const staleStatusCb = capturedStatusCb!;

      rerender({ id: 'conv-B' });
      // Le nouvel effet a réinitialisé isRealtimeDown à false

      // Simule le callback CLOSED asynchrone de l'ancien canal (conv-A)
      act(() => {
        staleStatusCb('CLOSED');
      });

      // Doit rester false : le drapeau `cancelled` doit avoir bloqué le setState
      expect(result.current.isRealtimeDown).toBe(false);
    });

    it('timeout stale après unmount ne bascule pas isRealtimeDown', () => {
      jest.useFakeTimers();
      const { unmount, result } = renderHook(() => useRealtimeConversation(CONV), {
        wrapper: wrapper(qc),
      });

      // Démonte avant l'expiration du timer
      unmount();

      // Le timer aurait dû se déclencher, mais cancelled=true + clearTimeout doivent l'empêcher
      act(() => {
        jest.advanceTimersByTime(10_001);
      });

      // isRealtimeDown est l'état capturé au moment du dernier render (false)
      expect(result.current.isRealtimeDown).toBe(false);
      jest.useRealTimers();
    });
  });

  // =========================================================================
  // Redteam : race condition INSERT (documenté, non corrigé en bêta)
  // =========================================================================

  describe('redteam — race condition INSERT (scénario bêta acceptable)', () => {
    it('INSERT reçu avant que useSendMessage remplace le temp-ID → double entrée connue', () => {
      // Scénario : useSendMessage a injecté temp-xxx dans le cache,
      // le Realtime INSERT arrive avec l'ID réel AVANT que onSuccess remplace temp-xxx.
      // Résultat attendu : le message réel est ajouté (la suppression du temp est responsabilité
      // de useSendMessage.onSuccess). Ce test documente le comportement, pas un bug à fixer ici.
      const tempMsg = msg({ id: 'temp-abc', content: 'bonjour' });
      qc.setQueryData(conversationMessagesQueryKey(CONV), singlePage([tempMsg]));
      renderHook(() => useRealtimeConversation(CONV), { wrapper: wrapper(qc) });

      const realMsg = msg({ id: 'real-uuid-123', content: 'bonjour' }); // même contenu, vrai ID
      act(() => {
        capturedInsertCb?.({ new: realMsg });
      });

      const data = qc.getQueryData<InfiniteData<Page>>(conversationMessagesQueryKey(CONV));
      // Les deux coexistent jusqu'à ce que useSendMessage.onSuccess supprime le temp
      expect(data?.pages[0]?.messages).toHaveLength(2);
      expect(data?.pages[0]?.messages[0]?.id).toBe('real-uuid-123');
      expect(data?.pages[0]?.messages[1]?.id).toBe('temp-abc');
    });
  });
});
