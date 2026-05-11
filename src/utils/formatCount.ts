// Formateur de compteurs pour affichage compact — E3-01.
// Utilisé pour les vues de posts, likes, etc.
// Conventions : 324, 1.2K, 12K (pas 12.0K), 1.2M

/**
 * Formate un nombre en string compacte pour l'UI.
 * - n < 1000 → "324"
 * - n >= 1000 → "1.2K" (1 décimale, sans .0 trailing → "12K")
 * - n >= 1_000_000 → "1.2M"
 */
export function formatViewCount(n: number): string {
  if (n < 1000) {
    return String(n);
  }

  if (n < 1_000_000) {
    const k = n / 1000;
    // Strip trailing .0 → "12K" pas "12.0K"
    return k % 1 === 0 ? `${Math.floor(k)}K` : `${k.toFixed(1)}K`;
  }

  const m = n / 1_000_000;
  return m % 1 === 0 ? `${Math.floor(m)}M` : `${m.toFixed(1)}M`;
}
