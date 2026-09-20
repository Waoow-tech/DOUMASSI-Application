// loginRateLimit.ts — E2-13.
//
// Logique PURE du rate limit login (testable sans AsyncStorage ni timer).
// ⚠️ C'est de l'UX uniquement : le rate limit serveur Supabase reste la source
// de vérité. Ici on évite juste des allers-retours inutiles après plusieurs
// échecs, avec un message clair « réessaie dans X:XX ».

export const MAX_FAILS = 5;
export const WINDOW_MS = 5 * 60_000; // fenêtre de comptage : 5 min
export const BLOCK_MS = 2 * 60_000; // durée de blocage : 2 min

export interface RateLimitState {
  /** Échecs consécutifs dans la fenêtre courante. */
  fails: number;
  /** Timestamp du 1er échec de la fenêtre courante. */
  firstFailAt: number;
  /** Timestamp de fin de blocage (0 = pas bloqué). */
  blockedUntil: number;
}

export const INITIAL_STATE: RateLimitState = { fails: 0, firstFailAt: 0, blockedUntil: 0 };

/**
 * Applique un ÉCHEC de login. Réinitialise la fenêtre si elle est expirée,
 * incrémente sinon, et bloque quand le seuil est atteint.
 */
export function registerFailure(state: RateLimitState, now: number): RateLimitState {
  const inWindow = state.fails > 0 && now - state.firstFailAt < WINDOW_MS;
  const fails = inWindow ? state.fails + 1 : 1;
  const firstFailAt = inWindow ? state.firstFailAt : now;

  if (fails >= MAX_FAILS) {
    // On bloque et on repart d'un compteur neuf pour l'après-blocage.
    return { fails: 0, firstFailAt: 0, blockedUntil: now + BLOCK_MS };
  }
  return { fails, firstFailAt, blockedUntil: 0 };
}

/** Login réussi → on efface tout. */
export function registerSuccess(): RateLimitState {
  return { ...INITIAL_STATE };
}

/** Millisecondes de blocage restantes (0 si non bloqué). */
export function remainingBlockMs(state: RateLimitState, now: number): number {
  return Math.max(0, state.blockedUntil - now);
}

/** Formate un temps restant en `M:SS`. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
