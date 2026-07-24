// Âge minimum — E13-01.
//
// Seuil aligné sur la majorité numérique française (15 ans) : en dessous, le
// consentement d'un représentant légal serait requis. Voir ADR-008 §2.2 et les
// CGU §5.
//
// ⚠️ Ce module est une validation de CONFORT (UX). L'application réelle de la
// règle est faite CÔTÉ SERVEUR par le trigger `enforce_min_age` sur `profiles` :
// un client modifié ne doit pas pouvoir créer un compte hors seuil.

export const MIN_AGE_YEARS = 15;

/** Parse une date saisie au format JJ/MM/AAAA. Retourne null si invalide. */
export function parseBirthday(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  // Rejette les dates "roulées" par JS (ex. 31/02 → 03/03).
  const isReal =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isReal ? date : null;
}

/** Âge révolu en années à la date du jour. Retourne null si la date est invalide. */
export function getAge(value: string, today: Date = new Date()): number | null {
  const birth = parseBirthday(value);
  if (!birth) return null;

  let age = today.getFullYear() - birth.getFullYear();
  // L'anniversaire n'est pas encore passé cette année → on retire un an.
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** true si la personne a au moins MIN_AGE_YEARS ans. Date invalide → false. */
export function isAtLeastMinAge(value: string, today: Date = new Date()): boolean {
  const age = getAge(value, today);
  return age !== null && age >= MIN_AGE_YEARS;
}
