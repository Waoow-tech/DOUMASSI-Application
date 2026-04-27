// Point d'entrée i18n — exporte le shortcut `t` utilisé partout dans l'app.
// Sprint 2 : remplacer par i18next avec détection de locale + fallback FR.

import { fr } from './fr';

export const t = fr;
export type { Translations } from './fr';
