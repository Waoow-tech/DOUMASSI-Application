// useQuizByResource — E9-11 (#271)
//
// Récupère le quiz rattaché à une ressource (s'il existe). La table quizzes a
// une RLS "public read" → simple select client, pas besoin de RPC. Sert à
// afficher sur la fiche soit "Passer le quiz" (existe) soit "Ajouter un quiz"
// (pas encore, si je suis l'auteur).

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ResourceQuizSummary {
  id: string;
  title: string;
  question_count: number;
}

export function quizByResourceQueryKey(resourceId: string) {
  return ['cours', 'quiz', 'byResource', resourceId] as const;
}

export function useQuizByResource(resourceId: string | null) {
  return useQuery({
    queryKey: resourceId
      ? quizByResourceQueryKey(resourceId)
      : ['cours', 'quiz', 'byResource', 'none'],
    enabled: Boolean(resourceId),
    queryFn: async (): Promise<ResourceQuizSummary | null> => {
      if (!resourceId) return null;
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, question_count')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) {
        logger.warn('useQuizByResource failed', { message: error.message, resourceId });
        throw error;
      }
      return (data as ResourceQuizSummary | null) ?? null;
    },
    staleTime: 30_000,
  });
}
