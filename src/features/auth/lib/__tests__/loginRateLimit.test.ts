// Tests E2-13 — logique du rate limit login

import {
  BLOCK_MS,
  formatRemaining,
  INITIAL_STATE,
  MAX_FAILS,
  registerFailure,
  registerSuccess,
  remainingBlockMs,
} from '@/features/auth/lib/loginRateLimit';

const T0 = 1_000_000; // timestamp de base non nul

describe('loginRateLimit', () => {
  it('bloque après MAX_FAILS échecs dans la fenêtre', () => {
    let s = INITIAL_STATE;
    // 4 premiers échecs : pas encore bloqué
    for (let i = 0; i < MAX_FAILS - 1; i++) {
      s = registerFailure(s, T0 + i * 1000);
    }
    expect(remainingBlockMs(s, T0 + 5000)).toBe(0);
    expect(s.fails).toBe(MAX_FAILS - 1);

    // 5e échec → blocage
    s = registerFailure(s, T0 + 5000);
    expect(remainingBlockMs(s, T0 + 5000)).toBe(BLOCK_MS);
  });

  it('réinitialise le compteur quand la fenêtre est expirée', () => {
    let s = registerFailure(INITIAL_STATE, T0);
    s = registerFailure(s, T0 + 1000);
    expect(s.fails).toBe(2);
    // 6 min plus tard → fenêtre (5 min) expirée → on repart à 1
    s = registerFailure(s, T0 + 6 * 60_000);
    expect(s.fails).toBe(1);
  });

  it('le succès efface tout', () => {
    let s = registerFailure(INITIAL_STATE, T0);
    s = registerFailure(s, T0 + 1000);
    s = registerSuccess();
    expect(s).toEqual(INITIAL_STATE);
  });

  it('le blocage expire après BLOCK_MS', () => {
    let s = INITIAL_STATE;
    for (let i = 0; i < MAX_FAILS; i++) s = registerFailure(s, T0 + i * 100);
    const blockedAt = T0 + (MAX_FAILS - 1) * 100;
    expect(remainingBlockMs(s, blockedAt)).toBeGreaterThan(0);
    expect(remainingBlockMs(s, blockedAt + BLOCK_MS)).toBe(0);
  });

  it('formatRemaining formate en M:SS', () => {
    expect(formatRemaining(125_000)).toBe('2:05');
    expect(formatRemaining(5_000)).toBe('0:05');
    expect(formatRemaining(60_000)).toBe('1:00');
  });
});
