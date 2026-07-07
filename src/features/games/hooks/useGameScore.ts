// useGameScore — E10-02 (#293)
//
// Scores des jeux : soumettre une partie, meilleur score perso, classement.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  best_score: number;
  is_me: boolean;
}

export function useMyBestGameScore(gameId: string | null) {
  return useQuery({
    queryKey: gameId ? ['games', 'best', gameId] : ['games', 'best', 'none'],
    enabled: Boolean(gameId),
    queryFn: async (): Promise<number | null> => {
      if (!gameId) return null;
      const { data, error } = await supabase.rpc('get_my_best_game_score', { p_game_id: gameId });
      if (error) {
        logger.warn('get_my_best_game_score failed', { message: error.message, gameId });
        throw error;
      }
      return typeof data === 'number' ? data : null;
    },
    staleTime: 30_000,
  });
}

export function useGameLeaderboard(gameId: string | null, limit = 20) {
  return useQuery({
    queryKey: gameId ? ['games', 'leaderboard', gameId, limit] : ['games', 'leaderboard', 'none'],
    enabled: Boolean(gameId),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!gameId) return [];
      const { data, error } = await supabase.rpc('get_game_leaderboard', {
        p_game_id: gameId,
        p_limit: limit,
      });
      if (error) {
        logger.warn('get_game_leaderboard failed', { message: error.message, gameId });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        user_id: String(r.user_id ?? ''),
        username: String(r.username ?? ''),
        avatar_url: (r.avatar_url as string | null) ?? null,
        is_verified: Boolean(r.is_verified ?? false),
        best_score: typeof r.best_score === 'number' ? r.best_score : 0,
        is_me: Boolean(r.is_me ?? false),
      }));
    },
    staleTime: 15_000,
  });
}

export function useSubmitGameScore() {
  const queryClient = useQueryClient();
  return useMutation<number, Error, { gameId: string; score: number }>({
    mutationFn: async ({ gameId, score }): Promise<number> => {
      const { data, error } = await supabase.rpc('submit_game_score', {
        p_game_id: gameId,
        p_score: score,
      });
      if (error) {
        logger.warn('submit_game_score failed', { message: error.message, gameId });
        throw error;
      }
      // Retourne le meilleur score après insertion.
      return typeof data === 'number' ? data : score;
    },
    onSuccess: (_best, { gameId }) => {
      void queryClient.invalidateQueries({ queryKey: ['games', 'best', gameId] });
      void queryClient.invalidateQueries({ queryKey: ['games', 'leaderboard', gameId] });
    },
  });
}
