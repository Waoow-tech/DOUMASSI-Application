// useLoginRateLimit — E2-13
//
// Couche UX au-dessus de la logique pure `loginRateLimit`. Elle :
//  - persiste l'état dans AsyncStorage (tuer l'app ne contourne PAS le blocage) ;
//  - expose un compte à rebours vivant (`remainingLabel` qui décrémente) ;
//  - fournit `recordFailure` / `recordSuccess` à brancher dans le flux de login.
//
// ⚠️ Rappel : c'est de l'UX anti-spam côté client. La vraie protection reste le
// rate limit serveur Supabase. Voir loginRateLimit.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatRemaining,
  INITIAL_STATE,
  registerFailure,
  registerSuccess,
  remainingBlockMs,
  type RateLimitState,
} from '@/features/auth/lib/loginRateLimit';
import { logger } from '@/lib/logger';

export const LOGIN_RATE_LIMIT_KEY = 'doumassi:login_rate_limit';

async function persist(state: RateLimitState) {
  try {
    await AsyncStorage.setItem(LOGIN_RATE_LIMIT_KEY, JSON.stringify(state));
  } catch (err) {
    // Non critique : au pire le blocage n'est pas persisté entre deux lancements.
    logger.warn('login_rate_limit_persist_failed', err);
  }
}

export function useLoginRateLimit() {
  // Ref = source de vérité immédiate (évite les closures périmées entre deux
  // échecs rapprochés) ; state = déclenche les re-renders du compte à rebours.
  const stateRef = useRef<RateLimitState>(INITIAL_STATE);
  const [remainingMs, setRemainingMs] = useState(0);

  // Recharge l'état persisté au montage.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(LOGIN_RATE_LIMIT_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as RateLimitState;
        stateRef.current = parsed;
        setRemainingMs(remainingBlockMs(parsed, Date.now()));
      })
      .catch((err) => logger.warn('login_rate_limit_read_failed', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Tic chaque seconde tant qu'un blocage est en cours, pour animer le décompte.
  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setInterval(() => {
      setRemainingMs(remainingBlockMs(stateRef.current, Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingMs]);

  /**
   * Enregistre un échec de login. Retourne `true` si l'utilisateur VIENT d'être
   * bloqué (transition), pour laisser le caller afficher un toast une seule fois.
   */
  const recordFailure = useCallback((): boolean => {
    const wasBlocked = remainingBlockMs(stateRef.current, Date.now()) > 0;
    const next = registerFailure(stateRef.current, Date.now());
    stateRef.current = next;
    void persist(next);
    const nowRemaining = remainingBlockMs(next, Date.now());
    setRemainingMs(nowRemaining);
    return !wasBlocked && nowRemaining > 0;
  }, []);

  /** Login réussi → on efface le compteur. */
  const recordSuccess = useCallback(() => {
    const next = registerSuccess();
    stateRef.current = next;
    void persist(next);
    setRemainingMs(0);
  }, []);

  return {
    isBlocked: remainingMs > 0,
    remainingMs,
    remainingLabel: formatRemaining(remainingMs),
    recordFailure,
    recordSuccess,
  };
}
