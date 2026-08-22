// Registry des mini-jeux — E10-02 (#293)
//
// Liste en dur des jeux curatés. game_id = clé stable utilisée pour les scores
// en DB. On enrichit ce tableau au fil des tickets E10-05 → E10-10.

import { Blocks, Car, Grid3x3, Layers, Plane, Worm, type LucideIcon } from 'lucide-react-native';

import { GAME_2048_HTML } from './game2048';
import { GAME_BREAKER_HTML } from './gameBreaker';
import { GAME_COURSE_HTML } from './gameCourse';
import { GAME_ENVOL_HTML } from './gameEnvol';
import { GAME_MEMORY_HTML } from './gameMemory';
import { GAME_SNAKE_HTML } from './gameSnake';

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
    accentColor: '#FFFFFF',
    bgColor: '#12291D',
    Icon: Grid3x3,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_2048_HTML,
  },
  {
    id: 'snake',
    title: 'Snake',
    description: 'Mange, grandis, ne te mords pas.',
    accentColor: '#FFFFFF',
    bgColor: '#12291D',
    Icon: Worm,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_SNAKE_HTML,
  },
  {
    id: 'memory',
    title: 'Memory',
    description: 'Retrouve les paires en un minimum de coups.',
    accentColor: '#3B82F6',
    bgColor: '#12203A',
    Icon: Layers,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_MEMORY_HTML,
  },
  {
    id: 'breaker',
    title: 'Casse-briques',
    description: 'Détruis toutes les briques avec la balle.',
    accentColor: '#F59E0B',
    bgColor: '#2E2410',
    Icon: Blocks,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_BREAKER_HTML,
  },
  {
    id: 'envol',
    title: 'Envol',
    description: 'Tape pour voler et éviter les obstacles.',
    accentColor: '#EC4899',
    bgColor: '#2E1522',
    Icon: Plane,
    scoreDirection: 'high',
    scoreLabel: 'Score',
    html: GAME_ENVOL_HTML,
  },
  {
    id: 'course',
    title: 'Course',
    description: 'Esquive le trafic le plus longtemps possible.',
    accentColor: '#3B82F6',
    bgColor: '#12203A',
    Icon: Car,
    scoreDirection: 'high',
    scoreLabel: 'Distance',
    html: GAME_COURSE_HTML,
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
