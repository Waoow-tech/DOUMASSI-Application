// Hook qui détermine l'état d'authentification + de complétion du profil.
// Source de vérité unique pour les guards de navigation (E2-07).
//
// États possibles :
//   - 'loading'           : check en cours, on affiche le splash
//   - 'unauthenticated'   : pas de session → /welcome
//   - 'incomplete'        : session OK mais pas de username du tout (cas rare) → /welcome
//   - 'incomplete-google' : session OK, username temporaire (user_XXXXXXXX) → /onboarding/complete-account
//   - 'onboarding'        : vrai username + onboarding pas marqué fait → /onboarding/complete-profile
//   - 'complete'          : vrai username + onboarding fait → /feed
//
// Le hook écoute supabase.auth.onAuthStateChange pour réagir aux login/logout
// en temps réel (pas besoin de re-mount le composant).
//
// Ticket E2-07 — Sprint 1 Auth & Onboarding (création).
// Ticket E2-09 — refactor : check `onboarding_completed` au lieu de scanner
//   les champs (évite la boucle infinie quand l'user skippe l'onboarding).
// Ticket E2-14 — détection username temporaire (cas Google OAuth fresh) pour
//   forcer l'écran complete-account avant le complete-profile.

import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'incomplete'
  | 'incomplete-google'
  | 'onboarding'
  | 'complete';

/** Pattern for temporary usernames assigned by the Google OAuth trigger. */
const TEMP_USERNAME_REGEX = /^user_[0-9a-f]{8}$/;

/**
 * Lit l'état du profil pour déterminer la prochaine étape de navigation.
 * Une seule query qui ramène les 2 colonnes utiles : `username` (signup terminé,
 * et permet de détecter le cas Google avec un username temporaire) et
 * `onboarding_completed` (post-signup terminé ou skippé ?).
 */
async function getProfileState(userId: string): Promise<{
  username: string | null;
  onboardingCompleted: boolean;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Échec lecture profile state', { message: error.message });
    // En cas d'erreur réseau, on considère l'état le plus restrictif (incomplete)
    // pour ne pas bloquer l'user dans le feed avec un compte mal initialisé.
    return { username: null, onboardingCompleted: false };
  }

  return {
    username: data?.username ?? null,
    onboardingCompleted: Boolean(data?.onboarding_completed),
  };
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

      const { username, onboardingCompleted } = await getProfileState(userId);
      if (cancelled) return;

      // Pas de username du tout (cas rare — trigger SQL a échoué)
      if (!username) {
        setStatus('incomplete');
        return;
      }

      // Username temporaire généré par le trigger pour les users Google OAuth
      // → besoin de l'écran complete-account pour fixer un vrai username + birthday
      if (TEMP_USERNAME_REGEX.test(username)) {
        setStatus('incomplete-google');
        return;
      }

      // Vrai username : on regarde si l'onboarding profil/cover a été fait/skippé
      setStatus(onboardingCompleted ? 'complete' : 'onboarding');
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