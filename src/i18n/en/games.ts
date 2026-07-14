// Dictionnaire ANGLAIS — namespace `games` (E11-08).
// Mêmes clés que fr/games.ts, valeurs en anglais naturel.

import type { GamesTranslations } from '../fr/games';

export const gamesEn: GamesTranslations = {
  catalog: {
    title: 'Games',
    back: 'Back',
    playLabel: (title: string) => `Play ${title}`,
    bestScore: (score: number) => `Best: ${score}`,
    neverPlayed: 'Not played yet',
  },
  play: {
    back: 'Back',
    notFoundTitle: 'Game not found',
    notFoundBack: 'Back',
    bestScore: (score: number) => `Best: ${score}`,
    leaderboardLabel: 'Leaderboard',
    leaderboardTitle: (title: string) => `Leaderboard — ${title}`,
    emptyLeaderboard: 'No scores yet. Be the first!',
    meSuffix: ' (you)',
  },
};
