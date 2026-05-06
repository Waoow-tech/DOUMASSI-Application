// Utilitaire de formatage auto pour les champs birthday (DD/MM/YYYY).
// Extrait du signup.tsx pour être réutilisé dans complete-account.tsx.
//
// Ticket E2-14 — Sprint 1 Auth & Onboarding.

/**
 * Auto-format birthday input : insère les "/" automatiquement
 * à mesure que l'utilisateur tape les chiffres.
 *
 * @example
 * formatBirthdayInput('25')    → '25'
 * formatBirthdayInput('2512')  → '25/12'
 * formatBirthdayInput('25122000') → '25/12/2000'
 */
export function formatBirthdayInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
