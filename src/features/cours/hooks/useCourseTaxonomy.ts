// useCourseTaxonomy — E9-04
//
// Récupère les référentiels niveaux + matières (tables course_levels /
// course_subjects, seed E9-01, lecture publique via RLS). La taxonomie ne
// change quasi jamais → staleTime très long + gcTime long, on évite de la
// refetch à chaque montée d'écran.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface CourseLevel {
  code: string;
  cycle: string;
  label: string;
  sort_order: number;
}

export interface CourseSubject {
  code: string;
  label: string;
  sort_order: number;
}

// Ordre d'affichage des cycles (les niveaux sont groupés par cycle à l'UI).
export const CYCLE_ORDER: { key: string; label: string }[] = [
  { key: 'primaire', label: 'Primaire' },
  { key: 'college', label: 'Collège' },
  { key: 'lycee', label: 'Lycée' },
  { key: 'superieur', label: 'Supérieur' },
  { key: 'tout_public', label: 'Tout public' },
];

const STALE = 60 * 60 * 1000; // 1 h

export function useCourseLevels() {
  return useQuery({
    queryKey: ['cours', 'taxonomy', 'levels'],
    staleTime: STALE,
    gcTime: STALE,
    queryFn: async (): Promise<CourseLevel[]> => {
      const { data, error } = await supabase
        .from('course_levels')
        .select('code, cycle, label, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) {
        logger.warn('course_levels fetch failed', { message: error.message });
        throw error;
      }
      return (data ?? []) as CourseLevel[];
    },
  });
}

export function useCourseSubjects() {
  return useQuery({
    queryKey: ['cours', 'taxonomy', 'subjects'],
    staleTime: STALE,
    gcTime: STALE,
    queryFn: async (): Promise<CourseSubject[]> => {
      const { data, error } = await supabase
        .from('course_subjects')
        .select('code, label, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) {
        logger.warn('course_subjects fetch failed', { message: error.message });
        throw error;
      }
      return (data ?? []) as CourseSubject[];
    },
  });
}
