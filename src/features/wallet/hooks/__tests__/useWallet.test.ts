// Tests E12 — hooks wallet
//
// Couverture :
//   • newIdempotencyKey : clés uniques (le socle de l'anti-double-débit).
//   • useWallet : lecture du solde (SELECT direct, RLS côté serveur).
//   • useWalletTransfer / useWalletSpend : appel de la BONNE RPC avec les BONS
//     paramètres (surtout la clé d'idempotence transmise telle quelle) + retour
//     du nouveau solde.
//   • useClaimDailyReward : réclame 1× et déclenche le toast quand un gain a lieu.

import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

// React Query batche ses notifications via setTimeout(0) → laisse un timer actif
// après le test (« worker failed to exit »). En test, on le rend synchrone.
notifyManager.setScheduler((cb) => cb());

import {
  newIdempotencyKey,
  useClaimDailyReward,
  useWallet,
  useWalletSpend,
  useWalletTransfer,
} from '@/features/wallet/hooks/useWallet';
import { useRewardToastStore } from '@/stores/rewardToastStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        maybeSingle: () => mockMaybeSingle(),
      }),
    }),
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

// Client par test, nettoyé en afterEach : sans ça, le gc de React Query laisse
// un timer actif → « worker failed to exit gracefully ».
let qc: QueryClient;

function makeClient() {
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return qc;
}

beforeEach(() => {
  mockRpc.mockReset();
  mockMaybeSingle.mockReset();
  useRewardToastStore.setState({ amount: null });
});

afterEach(() => {
  qc?.clear();
});

// ---------------------------------------------------------------------------
// newIdempotencyKey
// ---------------------------------------------------------------------------

describe('newIdempotencyKey', () => {
  it('génère des clés non vides et toutes distinctes', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const k = newIdempotencyKey();
      expect(typeof k).toBe('string');
      expect(k.length).toBeGreaterThan(0);
      keys.add(k);
    }
    // Aucune collision sur 500 tirages → la garantie anti-double-débit tient.
    expect(keys.size).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// useWallet — solde
// ---------------------------------------------------------------------------

describe('useWallet', () => {
  it('renvoie le solde lu sur la table wallets', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { balance: 110 }, error: null });

    const { result } = renderHook(() => useWallet(), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(110);
  });

  it('renvoie 0 si aucune ligne wallet (maybeSingle null)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useWallet(), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useWalletTransfer / useWalletSpend
// ---------------------------------------------------------------------------

describe('useWalletTransfer', () => {
  it('appelle wallet_transfer avec les bons paramètres et renvoie le nouveau solde', async () => {
    mockRpc.mockResolvedValue({ data: 90, error: null });

    const { result } = renderHook(() => useWalletTransfer(), { wrapper: wrapper(makeClient()) });

    let returned: number | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        toUserId: 'user-2',
        amount: 10,
        idempotencyKey: 'key-abc',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('wallet_transfer', {
      p_to_user: 'user-2',
      p_amount: 10,
      p_idempotency_key: 'key-abc',
      p_is_tip: false,
      p_reference_type: null,
      p_reference_id: null,
    });
    expect(returned).toBe(90);
  });

  it('propage isTip=true (pourboire) à la RPC', async () => {
    mockRpc.mockResolvedValue({ data: 50, error: null });

    const { result } = renderHook(() => useWalletTransfer(), { wrapper: wrapper(makeClient()) });
    await act(async () => {
      await result.current.mutateAsync({
        toUserId: 'author-1',
        amount: 20,
        idempotencyKey: 'tip-1',
        isTip: true,
      });
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'wallet_transfer',
      expect.objectContaining({ p_is_tip: true, p_to_user: 'author-1', p_amount: 20 })
    );
  });

  it('remonte l’erreur RPC (le mapper la traduit côté écran)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Solde insuffisant' } });

    const { result } = renderHook(() => useWalletTransfer(), { wrapper: wrapper(makeClient()) });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ toUserId: 'u2', amount: 999, idempotencyKey: 'k' });
      })
    ).rejects.toBeDefined();
  });
});

describe('useWalletSpend', () => {
  it('appelle wallet_spend avec les bons paramètres et renvoie le nouveau solde', async () => {
    mockRpc.mockResolvedValue({ data: 70, error: null });

    const { result } = renderHook(() => useWalletSpend(), { wrapper: wrapper(makeClient()) });
    let returned: number | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        amount: 30,
        idempotencyKey: 'spend-1',
        referenceType: 'listing_boost',
        referenceId: 'listing-9',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('wallet_spend', {
      p_amount: 30,
      p_idempotency_key: 'spend-1',
      p_reference_type: 'listing_boost',
      p_reference_id: 'listing-9',
    });
    expect(returned).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// useClaimDailyReward
// ---------------------------------------------------------------------------

describe('useClaimDailyReward', () => {
  it('réclame le bonus et déclenche le toast quand granted=true', async () => {
    mockRpc.mockResolvedValue({ data: { granted: true, amount: 10, balance: 110 }, error: null });

    renderHook(() => useClaimDailyReward(), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('wallet_claim_daily'));
    await waitFor(() => expect(useRewardToastStore.getState().amount).toBe(10));
  });

  it('ne déclenche PAS de toast quand déjà réclamé (granted=false)', async () => {
    mockRpc.mockResolvedValue({ data: { granted: false, amount: 0, balance: 110 }, error: null });

    renderHook(() => useClaimDailyReward(), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('wallet_claim_daily'));
    // Laisse la microtask se résoudre ; le toast doit rester à null.
    await act(async () => {
      await Promise.resolve();
    });
    expect(useRewardToastStore.getState().amount).toBeNull();
  });
});
