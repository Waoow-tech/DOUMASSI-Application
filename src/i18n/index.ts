// Point d'entrée i18n — E11-01.
//
// Deux façons d'accéder aux traductions :
//   • useTranslations() — hook RÉACTIF, dans un composant React. Le composant
//     se re-render quand l'utilisateur change de langue.
//   • getT() — accès NON-RÉACTIF, dans du code hors composant (hooks utilitaires,
//     libs, gestionnaires d'erreurs). Lit la langue courante à l'instant T.
//
// Les deux renvoient le même objet `Translations` (t.section.key).

import { useLanguageStore, type AppLanguage } from '@/stores/languageStore';

import { en } from './en';
import { fr, type Translations } from './fr';

const DICTIONARIES: Record<AppLanguage, Translations> = { fr, en };

/** Hook réactif — à utiliser dans les composants. */
export function useTranslations(): Translations {
  const language = useLanguageStore((state) => state.language);
  return DICTIONARIES[language];
}

/** Accès non-réactif — hors composant (lit la langue courante du store). */
export function getT(): Translations {
  return DICTIONARIES[useLanguageStore.getState().language];
}

export type { Translations };

/** Sous-objet des messages de validation Zod (schémas auth). */
export type AuthValidation = Translations['auth']['validation'];
