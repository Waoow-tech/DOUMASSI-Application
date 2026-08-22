// languageStore — E11-01.
// Langue de l'app (fr/en). Défaut = langue du téléphone (on n'impose plus le
// français). Choix persisté (AsyncStorage) → survit aux redémarrages.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppLanguage = 'fr' | 'en';

/** Langue du téléphone au 1er lancement — 'en' si l'appareil est en anglais,
 *  sinon on retombe sur le français. */
function detectDeviceLanguage(): AppLanguage {
  try {
    const code = Localization.getLocales()[0]?.languageCode?.toLowerCase();
    return code === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

interface LanguageState {
  language: AppLanguage;
  /** Vrai si l'utilisateur a explicitement choisi (vs détection auto). */
  hasChosen: boolean;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: detectDeviceLanguage(),
      hasChosen: false,
      setLanguage: (language) => set({ language, hasChosen: true }),
    }),
    {
      name: 'doumassi-language',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ language: state.language, hasChosen: state.hasChosen }),
    }
  )
);
