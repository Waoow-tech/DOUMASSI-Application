// Tests E2-13 — useLoginRateLimit (couche UX au-dessus de loginRateLimit).
//
// La logique pure est déjà couverte par loginRateLimit.test.ts ; ici on vérifie
// le comportement du hook : transition de blocage, reset au succès, expiration
// du décompte, et réhydratation depuis AsyncStorage au montage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { LOGIN_RATE_LIMIT_KEY, useLoginRateLimit } from '@/features/auth/hooks/useLoginRateLimit';
import { BLOCK_MS, MAX_FAILS } from '@/features/auth/lib/loginRateLimit';

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('useLoginRateLimit', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('bloque au MAX_FAILSᵉ échec et signale la transition', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    const flags: boolean[] = [];
    act(() => {
      for (let i = 0; i < MAX_FAILS; i++) flags.push(result.current.recordFailure());
    });

    // Les premiers échecs ne bloquent pas ; seul le dernier renvoie true.
    expect(flags.slice(0, MAX_FAILS - 1).every((f) => f === false)).toBe(true);
    expect(flags[MAX_FAILS - 1]).toBe(true);
    expect(result.current.isBlocked).toBe(true);
  });

  it('recordSuccess débloque immédiatement', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    act(() => {
      for (let i = 0; i < MAX_FAILS; i++) result.current.recordFailure();
    });
    expect(result.current.isBlocked).toBe(true);

    act(() => {
      result.current.recordSuccess();
    });
    expect(result.current.isBlocked).toBe(false);
  });

  it('le décompte se termine et débloque après BLOCK_MS', () => {
    const { result } = renderHook(() => useLoginRateLimit());

    act(() => {
      for (let i = 0; i < MAX_FAILS; i++) result.current.recordFailure();
    });
    expect(result.current.isBlocked).toBe(true);

    act(() => {
      jest.advanceTimersByTime(BLOCK_MS + 1000);
    });
    expect(result.current.isBlocked).toBe(false);
  });

  it('réhydrate un blocage encore actif depuis AsyncStorage au montage', async () => {
    await AsyncStorage.setItem(
      LOGIN_RATE_LIMIT_KEY,
      JSON.stringify({ fails: 0, firstFailAt: 0, blockedUntil: Date.now() + BLOCK_MS })
    );

    const { result } = renderHook(() => useLoginRateLimit());
    // Laisse le then() de lecture au montage se résoudre.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isBlocked).toBe(true);
  });
});
