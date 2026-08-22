// Hook useCreateStory — E4-12.
// Encapsule l'upload Storage + INSERT dans `stories`.
// N'envoie jamais author_id côté client (default auth.uid() BDD).
// expires_at géré côté BDD (default now() + interval '24 hours').

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { uploadStoryMedia } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface CreateStoryInput {
  uri: string;
  mediaType: 'image' | 'video';
  durationSeconds?: number;
}

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreateStoryInput>({
    mutationFn: async (input) => {
      const { publicUrl } = await uploadStoryMedia(input.uri, input.mediaType);

      const { error } = await supabase.from('stories').insert({
        media_url: publicUrl,
        media_type: input.mediaType,
        duration_seconds: input.durationSeconds ?? null,
      });

      if (error) throw new Error(error.message);
    },

    onSuccess: () => {
      // ['stories', 'feed'] → future visionneuse E4-13 (get_stories_feed RPC)
      // ['feed', 'stories']  → barre stories du feed (useFeedStories)
      void queryClient.invalidateQueries({ queryKey: ['stories', 'feed'] });
      void queryClient.invalidateQueries({ queryKey: ['feed', 'stories'] });
    },

    onError: (error) => {
      logger.error('create_story_failed', error);
    },
  });
}
