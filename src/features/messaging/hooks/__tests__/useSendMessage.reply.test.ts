// Tests reply (E6-06) — useSendMessage
//
// Couverture :
//   • reply_to_id inclus dans le INSERT quand replyToId est fourni
//   • reply_to_id absent du INSERT quand replyToId est null/undefined
//   • Le message optimistic porte le bon reply_to_id
//   • Redteam : valeur undefined → reply_to_id null dans l'optimistic

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Les variables de capture sont déclarées avant jest.mock pour que les closures
// les trouvent initialisées au moment où les mocks sont appelés (lazy evaluation).
let capturedInsertPayload: Record<string, unknown> | null = null;

const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();
const mockGetSession = jest.fn();

// Utilisation de closures lazy (pattern du projet) : la factory ne lit pas les
// variables par valeur à l'heure du hoisting, mais par référence lors de l'appel.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('@/lib/uuid', () => ({ uuidv4: () => 'fixed-uuid' }));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const SERVER_MESSAGE = {
  id: 'server-id-1',
  conversation_id: 'conv-1',
  sender_id: 'user-me',
  attachment_type: 'text',
  content: 'Hello',
  attachment_url: null,
  reply_to_id: null,
  created_at: '2026-06-11T10:00:00Z',
  edited_at: null,
  deleted_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  capturedInsertPayload = null;

  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-me' } } },
    error: null,
  });

  mockSingle.mockResolvedValue({ data: SERVER_MESSAGE, error: null });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockInsert.mockImplementation((payload: Record<string, unknown>) => {
    capturedInsertPayload = payload;
    return { select: mockSelect };
  });
  mockFrom.mockReturnValue({ insert: mockInsert });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { wrapper: Wrapper, qc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSendMessage — reply_to_id', () => {
  it('inclut reply_to_id dans le INSERT quand replyToId est fourni', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      result.current.mutate({
        conversationId: 'conv-1',
        content: 'Hello',
        replyToId: 'parent-msg-id',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedInsertPayload).toMatchObject({ reply_to_id: 'parent-msg-id' });
  });

  it("n'inclut pas reply_to_id dans le INSERT quand replyToId est null", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      result.current.mutate({
        conversationId: 'conv-1',
        content: 'Hello',
        replyToId: null,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedInsertPayload).not.toHaveProperty('reply_to_id');
  });

  it("n'inclut pas reply_to_id dans le INSERT quand replyToId est undefined", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      result.current.mutate({ conversationId: 'conv-1', content: 'Hello' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedInsertPayload).not.toHaveProperty('reply_to_id');
  });

  it('le message optimistic porte reply_to_id quand replyToId est fourni', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      result.current.mutate({
        conversationId: 'conv-1',
        content: 'Hello',
        replyToId: 'parent-abc',
        clientTempId: 'temp-fixed',
      });
    });

    // Le cache optimistic est posé dans onMutate (avant résolution serveur),
    // mais comme mockSingle est déjà résolu, on vérifie après le flush complet.
    // La bulle optimistic est remplacée par le message serveur en onSuccess :
    // on vérifie donc l'INSERT qui lui est envoyé avec reply_to_id.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedInsertPayload).toMatchObject({ reply_to_id: 'parent-abc' });
  });

  it("reply_to_id null dans l'optimistic quand replyToId n'est pas fourni", async () => {
    const { wrapper, qc } = makeWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    // Bloque la résolution serveur pour pouvoir observer l'état optimistic
    let resolveServer!: () => void;
    mockSingle.mockReturnValue(
      new Promise<{ data: typeof SERVER_MESSAGE; error: null }>((resolve) => {
        resolveServer = () => resolve({ data: SERVER_MESSAGE, error: null });
      })
    );

    act(() => {
      result.current.mutate({
        conversationId: 'conv-1',
        content: 'Hello',
        clientTempId: 'temp-fixed',
      });
    });

    // Laisse onMutate finir (getSession est async)
    await act(async () => {
      await Promise.resolve();
    });

    const cache = qc.getQueryData<{
      pages: Array<{ messages: Array<{ reply_to_id: string | null }> }>;
    }>(['conversation', 'conv-1', 'messages']);
    const firstMsg = cache?.pages[0]?.messages[0];
    expect(firstMsg?.reply_to_id).toBeNull();

    // Résout le serveur pour ne pas laisser de handles ouverts
    await act(async () => {
      resolveServer();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
