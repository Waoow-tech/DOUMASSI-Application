// useCreateResource — E9-06 (#266)
//
// Wrappe la RPC create_resource (security definer, author_id forcé à
// auth.uid() côté DB). Invalide les queries de la grille à success.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ResourceType } from './useResources';

export interface CreateResourceInput {
  type: ResourceType;
  levelCode: string;
  subjectCode: string;
  title: string;
  description?: string | null;
  files?: string[];
}

export function useCreateResource() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateResourceInput>({
    mutationFn: async (input): Promise<string> => {
      const { data, error } = await supabase.rpc('create_resource', {
        p_type: input.type,
        p_level_code: input.levelCode,
        p_subject_code: input.subjectCode,
        p_title: input.title,
        p_description: input.description ?? null,
        p_files: input.files ?? [],
      });
      if (error) {
        logger.warn('create_resource failed', { message: error.message, type: input.type });
        throw error;
      }
      return String(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cours'] });
    },
  });
}
