// Tests E5-14 — useSuggestCaption
//
// Couverture :
//   • Succès : upload de l'image puis appel de l'Edge Function avec le bon path
//     + contexte, et retour des suggestions.
//   • Erreur quota : le code `quota_exceeded` est extrait de la Response d'erreur
//     (pour le message dédié côté UI).
//   • Réponse vide : échec propre (`suggest_failed`).

import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

// React Query batche via setTimeout(0) → timer actif après le test. On rend
// l'ordonnanceur synchrone en test (cf. useWallet.test).
notifyManager.setScheduler((cb) => cb());

import { useSuggestCaption } from '@/features/ai/hooks/useSuggestCaption';

const mockUploadAiImage = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@/lib/storage', () => ({
  uploadAiImage: (...args: unknown[]) => mockUploadAiImage(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

let qc: QueryClient;
function makeClient() {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return qc;
}

beforeEach(() => {
  mockUploadAiImage.mockReset();
  mockInvoke.mockReset();
});

afterEach(() => {
  qc?.clear();
});

describe('useSuggestCaption', () => {
  it("upload l'image puis renvoie les suggestions de l'Edge Function", async () => {
    mockUploadAiImage.mockResolvedValue({ path: 'me/pic.jpg' });
    mockInvoke.mockResolvedValue({ data: { suggestions: ['A', 'B', 'C'] }, error: null });

    const { result } = renderHook(() => useSuggestCaption(), { wrapper: wrapper(makeClient()) });

    let out: string[] | undefined;
    await act(async () => {
      out = await result.current.mutateAsync({ imageUri: 'file://pic.jpg', context: 'coucou' });
    });

    expect(out).toEqual(['A', 'B', 'C']);
    expect(mockUploadAiImage).toHaveBeenCalledWith('file://pic.jpg');
    expect(mockInvoke).toHaveBeenCalledWith('ai-suggest-caption', {
      body: { image_path: 'me/pic.jpg', context: 'coucou' },
    });
  });

  it("remonte le code quota_exceeded depuis la Response d'erreur", async () => {
    mockUploadAiImage.mockResolvedValue({ path: 'me/pic.jpg' });
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ error: 'quota_exceeded' }) } },
    });

    const { result } = renderHook(() => useSuggestCaption(), { wrapper: wrapper(makeClient()) });

    let err: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({ imageUri: 'file://pic.jpg', context: '' });
      } catch (e) {
        err = e as Error;
      }
    });

    expect(err?.message).toBe('quota_exceeded');
  });

  it("échoue proprement si aucune suggestion n'est renvoyée", async () => {
    mockUploadAiImage.mockResolvedValue({ path: 'me/pic.jpg' });
    mockInvoke.mockResolvedValue({ data: { suggestions: [] }, error: null });

    const { result } = renderHook(() => useSuggestCaption(), { wrapper: wrapper(makeClient()) });

    let err: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({ imageUri: 'file://pic.jpg', context: '' });
      } catch (e) {
        err = e as Error;
      }
    });

    expect(err?.message).toBe('suggest_failed');
  });
});
