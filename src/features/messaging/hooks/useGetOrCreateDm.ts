import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { myConversationsQueryKey } from './useMyConversations';

export function useGetOrCreateDm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        p_other_user_id: otherUserId,
      });

      if (error) {
        logger.warn('get_or_create_dm failed', {
          message: error.message,
          otherUserId,
        });
        throw error;
      }

      return String(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myConversationsQueryKey });
    },
  });
}
