// useQuizPlay — E9-13 (#273)
//
// Hooks pour jouer un quiz :
//   - useQuiz : get_quiz (structure SANS les bonnes réponses)
//   - useSubmitQuizAttempt : submit_quiz_attempt (scoring serveur)
//   - useMyBestQuizScore : get_my_best_quiz_score (meilleur score)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type QuizQuestionType = 'single' | 'multiple' | 'boolean';

export interface PlayQuizOption {
  id: string;
  position: number;
  label: string;
}
export interface PlayQuizQuestion {
  id: string;
  position: number;
  prompt: string;
  type: QuizQuestionType;
  options: PlayQuizOption[];
}
export interface PlayQuiz {
  id: string;
  title: string;
  resource_id: string | null;
  level_code: string;
  subject_code: string;
  author_id: string;
  author_username: string;
  question_count: number;
  questions: PlayQuizQuestion[];
}

export interface QuizCorrection {
  question_id: string;
  is_correct: boolean;
  correct_option_ids: string[];
}
export interface QuizAttemptResult {
  score_pct: number;
  correct_count: number;
  total_count: number;
  corrections: QuizCorrection[];
}

function isType(v: unknown): v is QuizQuestionType {
  return v === 'single' || v === 'multiple' || v === 'boolean';
}

function mapQuiz(raw: Record<string, unknown>): PlayQuiz {
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    resource_id: (raw.resource_id as string | null) ?? null,
    level_code: String(raw.level_code ?? ''),
    subject_code: String(raw.subject_code ?? ''),
    author_id: String(raw.author_id ?? ''),
    author_username: String(raw.author_username ?? ''),
    question_count:
      typeof raw.question_count === 'number' ? raw.question_count : rawQuestions.length,
    questions: rawQuestions.map((q) => {
      const qq = q as Record<string, unknown>;
      const rawOptions = Array.isArray(qq.options) ? qq.options : [];
      return {
        id: String(qq.id ?? ''),
        position: typeof qq.position === 'number' ? qq.position : 0,
        prompt: String(qq.prompt ?? ''),
        type: isType(qq.type) ? qq.type : 'single',
        options: rawOptions.map((o) => {
          const oo = o as Record<string, unknown>;
          return {
            id: String(oo.id ?? ''),
            position: typeof oo.position === 'number' ? oo.position : 0,
            label: String(oo.label ?? ''),
          };
        }),
      };
    }),
  };
}

export function quizQueryKey(quizId: string) {
  return ['cours', 'quiz', 'play', quizId] as const;
}

export function useQuiz(quizId: string | null) {
  return useQuery({
    queryKey: quizId ? quizQueryKey(quizId) : ['cours', 'quiz', 'play', 'none'],
    enabled: Boolean(quizId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlayQuiz | null> => {
      if (!quizId) return null;
      const { data, error } = await supabase.rpc('get_quiz', { p_quiz_id: quizId });
      if (error) {
        logger.warn('get_quiz failed', { message: error.message, quizId });
        throw error;
      }
      if (!data || typeof data !== 'object') return null;
      return mapQuiz(data as Record<string, unknown>);
    },
  });
}

export interface SubmitAttemptInput {
  quizId: string;
  answers: { question_id: string; selected_option_ids: string[] }[];
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  return useMutation<QuizAttemptResult, Error, SubmitAttemptInput>({
    mutationFn: async ({ quizId, answers }): Promise<QuizAttemptResult> => {
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_answers: answers,
      });
      if (error) {
        logger.warn('submit_quiz_attempt failed', { message: error.message, quizId });
        throw error;
      }
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        score_pct: typeof r.score_pct === 'number' ? r.score_pct : 0,
        correct_count: typeof r.correct_count === 'number' ? r.correct_count : 0,
        total_count: typeof r.total_count === 'number' ? r.total_count : 0,
        corrections: Array.isArray(r.corrections)
          ? (r.corrections as Record<string, unknown>[]).map((c) => ({
              question_id: String(c.question_id ?? ''),
              is_correct: Boolean(c.is_correct),
              correct_option_ids: Array.isArray(c.correct_option_ids)
                ? (c.correct_option_ids as string[])
                : [],
            }))
          : [],
      };
    },
    onSuccess: (_res, { quizId }) => {
      void queryClient.invalidateQueries({ queryKey: ['cours', 'quiz', 'best', quizId] });
    },
  });
}

export function useMyBestQuizScore(quizId: string | null) {
  return useQuery({
    queryKey: quizId ? ['cours', 'quiz', 'best', quizId] : ['cours', 'quiz', 'best', 'none'],
    enabled: Boolean(quizId),
    queryFn: async (): Promise<number | null> => {
      if (!quizId) return null;
      const { data, error } = await supabase.rpc('get_my_best_quiz_score', { p_quiz_id: quizId });
      if (error) {
        logger.warn('get_my_best_quiz_score failed', { message: error.message, quizId });
        throw error;
      }
      return typeof data === 'number' ? data : null;
    },
  });
}
