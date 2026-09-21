// useVoiceInput — E5-12 (stub WEB / défaut).
//
// L'enregistrement audio repose sur expo-audio (module natif). Sur le web,
// expo-audio n'a pas d'implémentation utilisable ici : on renvoie un contrôleur
// inerte avec `supported: false`, ce qui masque le bouton micro côté UI. La
// vraie logique vit dans useVoiceInput.native.ts (résolu par Metro sur natif).
//
// ⚠️ Ce fichier NE DOIT PAS importer expo-audio, sinon le bundle web planterait
// à l'évaluation (cf. split Daily.co / CallScreen).

import type { UseVoiceInputOptions, VoiceInputController } from '@/features/ai/lib/voiceInput';

export function useVoiceInput(_options: UseVoiceInputOptions): VoiceInputController {
  return {
    supported: false,
    isRecording: false,
    isTranscribing: false,
    durationMs: 0,
    start: () => {},
    stopAndTranscribe: () => {},
    cancel: () => {},
  };
}
