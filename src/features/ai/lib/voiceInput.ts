// voiceInput — E5-12
//
// Contrat partagé entre l'implémentation native (expo-audio) et le stub web du
// hook useVoiceInput, + helpers PURS (testables sans module natif).

/** Codes d'erreur remontés à l'UI pour un message dédié. */
export type VoiceInputErrorKind = 'permission' | 'too_short' | 'quota' | 'failed';

export interface UseVoiceInputOptions {
  /** Appelé avec le texte transcrit (à injecter dans la saisie). */
  onTranscribed: (text: string) => void;
  /** Appelé en cas d'échec, avec le motif. */
  onError: (kind: VoiceInputErrorKind) => void;
}

export interface VoiceInputController {
  /** false = plateforme non supportée (web pour l'instant) → cacher le micro. */
  supported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  /** Durée d'enregistrement écoulée (ms), pour le chrono/indicateur. */
  durationMs: number;
  /** Démarre l'enregistrement (demande la permission micro). */
  start: () => void;
  /** Stoppe et lance la transcription. */
  stopAndTranscribe: () => void;
  /** Annule sans transcrire. */
  cancel: () => void;
}

/** Durée minimale d'un enregistrement exploitable (ms). */
export const MIN_RECORDING_MS = 700;

/** Formate une durée en `M:SS`. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
