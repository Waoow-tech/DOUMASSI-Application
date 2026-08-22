// useFeedStories — barre de stories au-dessus du fil d'actualité.
//
// Consomme la RPC `get_stories_feed` (livrée PR #181) qui retourne uniquement
// les stories ACTIVES (non expirées) des follows acceptés + les miennes.
//
// La barre affiche toujours mon entry en premier (avec un + si je n'ai pas de
// story active → tap = créer). Pour les autres users, on n'affiche QUE ceux
// qui ont une story active. Sinon on aurait un avatar dans la barre qui
// ouvre la visionneuse sur "rien" et fallback sur ma story (bug pré-bêta).

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type FeedStory = {
  id: string;
  username: string;
  avatar_url: string | null;
  isMe: boolean;
  hasUnseenStory: boolean;
};

type StoriesFeedRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  viewed_by_me: boolean;
  is_mine: boolean;
};

export function useFeedStories() {
  return useQuery({
    queryKey: ['feed', 'stories'],
    queryFn: async (): Promise<FeedStory[]> => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user?.id) {
        throw new Error('No authenticated user');
      }
      const userId = sessionData.session.user.id;

      // 1. RPC get_stories_feed : ne retourne que les stories actives,
      //    mes stories en premier, puis celles des follows acceptés.
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_stories_feed');
      if (rpcError) {
        logger.warn('get_stories_feed failed in feed bar', { message: rpcError.message });
        throw rpcError;
      }

      const rows = (rpcData ?? []) as StoriesFeedRow[];

      // 2. Group par author_id et calcule hasUnseenStory (au moins une story
      //    non vue) pour chaque auteur.
      const groupsByAuthor = new Map<string, { story: StoriesFeedRow; hasUnseen: boolean }>();
      for (const row of rows) {
        const existing = groupsByAuthor.get(row.author_id);
        if (existing) {
          existing.hasUnseen = existing.hasUnseen || !row.viewed_by_me;
        } else {
          groupsByAuthor.set(row.author_id, { story: row, hasUnseen: !row.viewed_by_me });
        }
      }

      const myGroup = groupsByAuthor.get(userId);
      const othersWithStories = Array.from(groupsByAuthor.entries())
        .filter(([authorId]) => authorId !== userId)
        .map(([, { story, hasUnseen }]) => ({
          id: story.author_id,
          username: story.author_username,
          avatar_url: story.author_avatar_url,
          isMe: false,
          hasUnseenStory: hasUnseen,
        }));

      // 3. Mon entry est toujours présent (même sans story active → permet le
      //    "tap = créer une story"). Si j'ai des stories actives, on affiche
      //    mon avatar avec hasUnseenStory selon viewed_by_me. Sinon, fallback
      //    sur mon profil neutre (avatar/username récupéré via select séparé).
      let meEntry: FeedStory;
      if (myGroup) {
        meEntry = {
          id: myGroup.story.author_id,
          username: myGroup.story.author_username,
          avatar_url: myGroup.story.author_avatar_url,
          isMe: true,
          hasUnseenStory: myGroup.hasUnseen,
        };
      } else {
        // Pas de story active de ma part : on fetch juste mon profile pour
        // afficher mon avatar dans la barre.
        const meRes = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', userId)
          .single();
        if (meRes.error) {
          logger.warn('fetch feed story self profile failed', { message: meRes.error.message });
          throw meRes.error;
        }
        meEntry = {
          id: meRes.data.id,
          username: meRes.data.username ?? 'Moi',
          avatar_url: meRes.data.avatar_url,
          isMe: true,
          hasUnseenStory: false,
        };
      }

      return [meEntry, ...othersWithStories];
    },
    staleTime: 30_000,
  });
}
