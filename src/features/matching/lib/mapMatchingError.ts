// Traduit les refus de garde-fou de `get_matching_candidates` (E13-04).
//
// La RPC lève des exceptions plpgsql avec des messages FRANÇAIS codés en dur
// côté Postgres (le serveur ne connaît pas la langue de l'app). On les reconnaît
// ici pour afficher la bonne traduction — et surtout pour proposer la bonne
// action (activer l'opt-in / compléter sa date de naissance).
//
// ⚠️ Couplage assumé, comme mapWalletError : changer le wording d'une exception
// dans la RPC impose de mettre ce mapper à jour.

import { getT } from '@/i18n';

export type MatchingErrorKind = 'optInRequired' | 'birthdayRequired' | 'generic';

export function classifyMatchingError(message: string | undefined | null): MatchingErrorKind {
  if (!message) return 'generic';
  const lower = message.toLowerCase();

  if (lower.includes('mise en relation sur ton profil')) return 'optInRequired';
  if (lower.includes('date de naissance')) return 'birthdayRequired';
  return 'generic';
}

export function mapMatchingError(message: string | undefined | null): string {
  const e = getT().matching.discovery.errors;
  switch (classifyMatchingError(message)) {
    case 'optInRequired':
      return e.optInRequired;
    case 'birthdayRequired':
      return e.birthdayRequired;
    default:
      return e.generic;
  }
}
