// Hook qui check en live si un username est disponible côté Supabase.
// Debounce 500ms pour éviter de spam la BDD à chaque frappe.
//
// Match case-insensitive (cohérent avec l'index profiles_username_unique_lower_idx).
// Suppose une RLS policy qui autorise SELECT de username pour anon/public users.
//
// État retourné :
//   - 'idle'      : pas de check (username trop court ou format invalide — Zod prendra le relais)
//   - 'checking'  : query en cours (debounce écoulé, requête envoyée)
//   - 'available' : username disponible
//   - 'taken'     : username déjà utilisé
//   - 'error'     : query a échoué (réseau, RLS, etc.)
//
// Ticket E2-08 — Sprint 1 Auth & Onboarding.

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;
const DEBOUNCE_MS = 500;

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export function useUsernameAvailability(username: string): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>('idle');

  useEffect(() => {
    const trimmed = username.trim();

    // Skip si format invalide — Zod gère le message d'erreur côté form
    if (
      trimmed.length < MIN_LENGTH ||
      trimmed.length > MAX_LENGTH ||
      !USERNAME_REGEX.test(trimmed)
    ) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        // ilike sans wildcards = match exact case-insensitive
        // (matche le LOWER(username) de notre unique index)
        .ilike('username', trimmed)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        logger.warn('Username availability check failed', { message: error.message });
        setStatus('error');
        return;
      }

      setStatus(data ? 'taken' : 'available');
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [username]);

  return status;
}
