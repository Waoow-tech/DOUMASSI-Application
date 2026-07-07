// Registry des mini-jeux — E10-02 (#293)
//
// Liste en dur des jeux curatés. game_id = clé stable utilisée pour les scores
// en DB. On enrichit ce tableau au fil des tickets E10-05 → E10-10.

import { Grid3x3, type LucideIcon } from 'lucide-react-native';

import { GAME_2048_HTML } from './game2048';

export interface GameDef {
  id: string;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
  Icon: LucideIcon;
  /** Sens du score : 'high' = plus c'est haut mieux c'est. */
  scoreDirection: 'high';
  scoreLabel: string;
  html: string;
}

export const GAMES: GameDef[] = [
  {
    id: '2048',
    title: '2048',
    description: 'Fusionne les tuiles pour atteindre 2048.',
    accentColor: '#10D970',
    bgColor: '#12291D',
    Icon: Grid3x3,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_2048_HTML,
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
