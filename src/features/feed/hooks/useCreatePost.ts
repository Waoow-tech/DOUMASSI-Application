// Hook useCreatePost — E4-05.
// Encapsule l'INSERT dans `posts` + invalidation des caches feed et profile.
// N'envoie jamais author_id côté client (RLS default via auth.uid()).

import { useQueryClient, useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload attendu par le caller (E4-03 CreatePostScreen). */
export interface CreatePostInput {
  content: string;
  media_urls: string[];
  media_type: 'text' | 'image' | 'video';
}

/** Row retournée par le SELECT après INSERT. */
interface PostRow {
  id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  media_type: 'text' | 'image' | 'video';
  created_at: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation<PostRow, Error, CreatePostInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          content: input.content,
          media_urls: input.media_urls,
          media_type: input.media_type,
          // author_id : géré par default auth.uid() côté BDD
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as PostRow;
    },

    onSuccess: (data) => {
      // Invalide le feed global pour refetch
      void queryClient.invalidateQueries({
        queryKey: ['feed'],
      });

      // Invalide le grid de posts du profil de l'auteur
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'user', data.author_id, 'posts'],
      });

      // Invalide aussi le grid "mes posts" (profil personnel)
      void queryClient.invalidateQueries({
        queryKey: ['profile', 'me', 'posts'],
      });

      logger.info('post_created', { post_id: data.id });
    },

    onError: (error) => {
      // On passe l'objet Error tel quel : `logger.error` le route vers
      // Sentry.captureException (cf. src/lib/logger.ts), ce qui conserve la
      // stack trace. Le réduire à { message } le ferait tomber dans la
      // branche captureMessage — stack perdue.
      logger.error('create_post_failed', error);
    },
  });
}
