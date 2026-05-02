// Hook qui détermine l'état d'authentification + de complétion du profil.
// Source de vérité unique pour les guards de navigation (E2-07).
//
// États possibles :
//   - 'loading'        : check en cours, on affiche le splash
//   - 'unauthenticated': pas de session → /welcome
//   - 'incomplete'     : session OK mais profil pas fini (pas de username) → /onboarding
//   - 'complete'       : session OK + profil complet → /feed
//
// Le hook écoute supabase.auth.onAuthStateChange pour réagir aux login/logout
// en temps réel (pas besoin de re-mount le composant).
//
// Ticket E2-07 — Sprint 1 Auth & Onboarding.

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type AuthStatus = 'loading' | 'unauthenticated' | 'incomplete' | 'complete';

/**
 * Vérifie auprès de Supabase si le profil de l'utilisateur courant est complet.
 * Pour le MVP, on considère un profil complet si `username` est non-null.
 * Les autres champs (avatar, cover, intérêts) viendront avec E2-09 à E2-11.
 */
async function isProfileComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Échec lecture profile', { message: error.message });
    // En cas d'erreur réseau, on considère le profil incomplet plutôt que de bloquer l'user
    // sur le feed avec un compte cassé.
    return false;
  }

  return Boolean(data?.username);
}

export function useAuthGuard() {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const resolveStatus = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      const complete = await isProfileComplete(userId);
      if (cancelled) return;
      setStatus(complete ? 'complete' : 'incomplete');
    };

    // Initial check (cold start)
    supabase.auth.getSession().then(({ data }) => {
      void resolveStatus(data.session?.user?.id);
    });

    // Listener pour login/logout en cours de route
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Auth state changed', { event });
      void resolveStatus(session?.user?.id);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return status;
}
