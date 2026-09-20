// calculator.ts — E5-18 (Tools).
//
// Évalue une expression mathématique via mathjs. mathjs PARSE et évalue des
// maths — ce n'est pas un `eval` JS, donc pas d'exécution de code arbitraire.
// On entoure quand même d'un try/catch, on plafonne la longueur (garde-fou) et
// on renvoie un résultat typé (jamais d'exception qui remonte à l'UI).

import { evaluate } from 'mathjs';

/** Longueur max d'une expression (anti-abus / anti-expression pathologique). */
const MAX_EXPR_LENGTH = 200;

export type CalcResult = { ok: true; result: string } | { ok: false; error: 'empty' | 'invalid' };

export function calculate(expression: string): CalcResult {
  const expr = expression.trim();
  if (expr.length === 0) return { ok: false, error: 'empty' };
  if (expr.length > MAX_EXPR_LENGTH) return { ok: false, error: 'invalid' };

  try {
    const value: unknown = evaluate(expr);

    // On refuse ce qui n'est pas un résultat exploitable : nombre non fini
    // (1/0 → Infinity), fonction (ex. `sqrt` seul), undefined.
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { ok: false, error: 'invalid' };
    }
    if (value === undefined || typeof value === 'function') {
      return { ok: false, error: 'invalid' };
    }

    return { ok: true, result: formatResult(value) };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

/** Formatage lisible. Pour les nombres, arrondi léger contre les artefacts
 *  flottants (0.1 + 0.2 → 0.30000000000000004). */
function formatResult(value: unknown): string {
  if (typeof value === 'number') {
    return String(Math.round(value * 1e10) / 1e10);
  }
  return String(value);
}
