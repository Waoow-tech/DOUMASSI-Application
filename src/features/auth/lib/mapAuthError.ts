// Mappe les erreurs Supabase Auth vers des messages utilisateur (FR/EN).
// Supabase renvoie des messages anglais bruts ("email rate limit exceeded"…).
// On les normalise pour afficher un texte cohérent et compréhensible.
// getT() (non-réactif) : lit la langue courante au moment de l'appel.

import { getT } from '@/i18n';

export function mapAuthError(message: string | undefined | null): string {
  const e = getT().auth.errors;
  if (!message) return e.unknown;

  const lower = message.toLowerCase();

  if (lower.includes('rate limit')) return e.rateLimit;
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return e.emailAlreadyUsed;
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials'))
    return e.invalidCredentials;
  if (lower.includes('email not confirmed') || lower.includes('not confirmed'))
    return e.emailNotConfirmed;
  if (lower.includes('invalid email') || lower.includes('valid email')) return e.invalidEmail;
  if (lower.includes('user not found') || lower.includes('no user')) return e.userNotFound;
  if (lower.includes('expired') || lower.includes('invalid token') || lower.includes('jwt'))
    return e.expiredLink;
  if (lower.includes('weak password') || lower.includes('should be at least'))
    return e.weakPassword;
  if (lower.includes('same as the old') || lower.includes('different from the old'))
    return e.samePassword;
  if (lower.includes('network') || lower.includes('fetch')) return e.network;

  return e.unknown;
}
