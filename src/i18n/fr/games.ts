// Dictionnaire FRANÇAIS — namespace `games` (E11-08).
// Jeux : catalogue, écran de jeu (WebView), classement, meilleur score.
// Tutoiement volontaire (cohérent avec le ton de l'app).

export const gamesFr = {
  // Écran catalogue — app/games/index.tsx
  catalog: {
    title: 'Jeux',
    back: 'Retour',
    playLabel: (title: string) => `Jouer à ${title}`,
    bestScore: (score: number) => `Meilleur : ${score}`,
    neverPlayed: 'Pas encore joué',
  },
  // Écran de jeu + classement — app/games/[id].tsx
  play: {
    back: 'Retour',
    notFoundTitle: 'Jeu introuvable',
    notFoundBack: 'Retour',
    bestScore: (score: number) => `Meilleur : ${score}`,
    leaderboardLabel: 'Classement',
    leaderboardTitle: (title: string) => `Classement — ${title}`,
    emptyLeaderboard: 'Aucun score pour l’instant. Sois le premier !',
    meSuffix: ' (toi)',
  },
};

export type GamesTranslations = typeof gamesFr;
