// quizImport — E9-12 (#272)
//
// "Colle tes questions" : l'user génère ses questions avec SON IA (ChatGPT…)
// via un prompt cadré qu'on lui fournit, puis colle le résultat JSON. On parse
// + valide ce JSON pour peupler l'éditeur (E9-11). Zéro coût IA pour nous.

import type { QuizQuestionType } from '../hooks/useCreateQuiz';

// Format de sortie imposé à l'IA de l'user. Volontairement strict pour être
// parsable sans ambiguïté.
export const QUIZ_IMPORT_PROMPT = `Génère un quiz à partir du cours ci-dessous.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte avant ou après, au format EXACT suivant :

[
  {
    "prompt": "énoncé de la question",
    "type": "single",
    "options": [
      { "label": "une réponse", "is_correct": true },
      { "label": "une autre réponse", "is_correct": false }
    ]
  }
]

Règles STRICTES :
- "type" vaut "single" (une seule bonne réponse) ou "multiple" (plusieurs bonnes réponses).
- Chaque question a entre 2 et 5 options.
- Au moins une option a "is_correct": true.
- Réponds en français.
- 5 à 10 questions.

Cours :
<<< COLLE TON COURS ICI >>>`;

export interface ParsedQuizQuestion {
  prompt: string;
  type: QuizQuestionType;
  options: { label: string; is_correct: boolean }[];
}

export type QuizParseResult =
  | { ok: true; questions: ParsedQuizQuestion[] }
  | { ok: false; error: string };

// Retire un éventuel fence markdown ```json ... ``` que l'IA aurait ajouté.
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? (fence[1] ?? '').trim() : trimmed;
}

function isType(value: unknown): value is QuizQuestionType {
  return value === 'single' || value === 'multiple' || value === 'boolean';
}

/**
 * Parse + valide le JSON collé. Messages d'erreur FR clairs pour guider l'user.
 */
export function parseQuizImport(raw: string): QuizParseResult {
  const cleaned = stripCodeFence(raw);
  if (cleaned.length === 0) {
    return { ok: false, error: 'Le champ est vide. Colle le JSON généré par ton IA.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: "Le texte n'est pas un JSON valide. Vérifie que tu as bien copié tout le tableau.",
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Le JSON doit être un tableau de questions.' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'Aucune question trouvée dans le JSON.' };
  }

  const questions: ParsedQuizQuestion[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i] as Record<string, unknown>;
    const label = `Question ${i + 1}`;

    if (typeof q?.prompt !== 'string' || q.prompt.trim().length === 0) {
      return { ok: false, error: `${label} : énoncé ("prompt") manquant.` };
    }
    const type: QuizQuestionType = isType(q.type) ? q.type : 'single';

    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { ok: false, error: `${label} : il faut au moins 2 options.` };
    }

    const options: { label: string; is_correct: boolean }[] = [];
    let hasCorrect = false;
    for (let j = 0; j < q.options.length; j++) {
      const o = q.options[j] as Record<string, unknown>;
      if (typeof o?.label !== 'string' || o.label.trim().length === 0) {
        return { ok: false, error: `${label}, option ${j + 1} : libellé manquant.` };
      }
      const isCorrect = o.is_correct === true;
      if (isCorrect) hasCorrect = true;
      options.push({ label: o.label.trim(), is_correct: isCorrect });
    }
    if (!hasCorrect) {
      return { ok: false, error: `${label} : indique au moins une bonne réponse.` };
    }

    questions.push({ prompt: q.prompt.trim(), type, options });
  }

  return { ok: true, questions };
}
