// quizImport — E9-12 (#272)
//
// "Colle tes questions" : l'user génère ses questions avec SON IA (ChatGPT…)
// via un prompt cadré qu'on lui fournit, puis colle le résultat JSON. On parse
// + valide ce JSON pour peupler l'éditeur (E9-11). Zéro coût IA pour nous.

import { getT } from '@/i18n';

import type { QuizQuestionType } from '../hooks/useCreateQuiz';

// Le prompt imposé à l'IA de l'user est dans le dico i18n
// (`t.cours.quizImport.prompt`) — traduit selon la langue de l'app.

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
  const t = getT();
  const e = t.cours.quizImport.errors;
  const cleaned = stripCodeFence(raw);
  if (cleaned.length === 0) {
    return { ok: false, error: e.empty };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: e.invalidJson };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: e.notArray };
  }
  if (parsed.length === 0) {
    return { ok: false, error: e.noQuestions };
  }

  const questions: ParsedQuizQuestion[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i] as Record<string, unknown>;
    const label = t.cours.quizImport.questionLabel(i + 1);

    if (typeof q?.prompt !== 'string' || q.prompt.trim().length === 0) {
      return { ok: false, error: e.promptMissing(label) };
    }
    const type: QuizQuestionType = isType(q.type) ? q.type : 'single';

    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { ok: false, error: e.minOptions(label) };
    }

    const options: { label: string; is_correct: boolean }[] = [];
    let hasCorrect = false;
    for (let j = 0; j < q.options.length; j++) {
      const o = q.options[j] as Record<string, unknown>;
      if (typeof o?.label !== 'string' || o.label.trim().length === 0) {
        return { ok: false, error: e.optionLabelMissing(label, j + 1) };
      }
      const isCorrect = o.is_correct === true;
      if (isCorrect) hasCorrect = true;
      options.push({ label: o.label.trim(), is_correct: isCorrect });
    }
    if (!hasCorrect) {
      return { ok: false, error: e.correctMissing(label) };
    }

    questions.push({ prompt: q.prompt.trim(), type, options });
  }

  return { ok: true, questions };
}
