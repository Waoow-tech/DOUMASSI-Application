// useCreateQuiz — E9-11 (#271)
//
// Wrappe la RPC create_quiz (création imbriquée questions+options en 1 appel).
// author_id forcé à auth.uid() côté DB. Validation métier (≥1 question, ≥2
// options, ≥1 bonne réponse) faite côté DB aussi — on valide en amont côté
// client pour un meilleur feedback.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type QuizQuestionType = 'single' | 'multiple' | 'boolean';

export interface QuizOptionInput {
  label: string;
  is_correct: boolean;
}

export interface QuizQuestionInput {
  prompt: string;
  type: QuizQuestionType;
  options: QuizOptionInput[];
}

export interface CreateQuizInput {
  title: string;
  levelCode: string;
  subjectCode: string;
  questions: QuizQuestionInput[];
  resourceId?: string | null;
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateQuizInput>({
    mutationFn: async (input): Promise<string> => {
      const { data, error } = await supabase.rpc('create_quiz', {
        p_title: input.title,
        p_level_code: input.levelCode,
        p_subject_code: input.subjectCode,
        p_questions: input.questions,
        p_resource_id: input.resourceId ?? null,
      });
      if (error) {
        logger.warn('create_quiz failed', { message: error.message });
        throw error;
      }
      return String(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cours', 'quiz'] });
    },
  });
}
