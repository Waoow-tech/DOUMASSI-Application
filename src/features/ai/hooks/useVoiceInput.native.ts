// useVoiceInput — E5-12 (implémentation NATIVE).
//
// Enregistre une note vocale avec expo-audio, l'encode en base64 et la transcrit
// via l'Edge Function ai-transcribe (Whisper/Groq). Le texte obtenu est renvoyé
// à l'appelant (qui l'injecte dans la saisie, éditable avant envoi).

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef, useState } from 'react';

import {
  MIN_RECORDING_MS,
  type UseVoiceInputOptions,
  type VoiceInputController,
} from '@/features/ai/lib/voiceInput';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface TranscribeResponse {
  text?: string;
  error?: string;
}

export function useVoiceInput({
  onTranscribed,
  onError,
}: UseVoiceInputOptions): VoiceInputController {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [isTranscribing, setIsTranscribing] = useState(false);
  // Garde le fait qu'un enregistrement est réellement en cours (record() lancé),
  // pour que cancel() n'appelle stop() que si nécessaire.
  const activeRef = useRef(false);

  const cleanupFile = useCallback(async (uri: string | null) => {
    if (!uri) return;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        onError('permission');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      activeRef.current = true;
    } catch (err) {
      logger.warn('voice_start_failed', err);
      onError('failed');
    }
  }, [recorder, onError]);

  const stopAndTranscribe = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;

    const durationMs = recorderState.durationMillis ?? 0;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
    } catch (err) {
      logger.warn('voice_stop_failed', err);
      onError('failed');
      return;
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

    // Trop court → pas la peine d'appeler Whisper.
    if (!uri || durationMs < MIN_RECORDING_MS) {
      await cleanupFile(uri);
      onError('too_short');
      return;
    }

    setIsTranscribing(true);
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data, error } = await supabase.functions.invoke<TranscribeResponse>('ai-transcribe', {
        body: { audio_base64: audioBase64, mime: 'audio/mp4' },
      });

      if (error) {
        // Le code métier (429 quota_exceeded…) est dans error.context.
        let code = 'failed';
        try {
          const ctx = (error as { context?: { json?: () => Promise<TranscribeResponse> } }).context;
          const bodyErr = await ctx?.json?.();
          if (bodyErr?.error) code = bodyErr.error;
        } catch {
          /* corps illisible */
        }
        onError(code === 'quota_exceeded' ? 'quota' : 'failed');
        return;
      }

      const text = data?.text?.trim() ?? '';
      if (text.length === 0) {
        onError('too_short');
        return;
      }
      onTranscribed(text);
    } catch (err) {
      logger.warn('voice_transcribe_failed', err);
      onError('failed');
    } finally {
      setIsTranscribing(false);
      await cleanupFile(uri);
    }
  }, [recorder, recorderState.durationMillis, onTranscribed, onError, cleanupFile]);

  const cancel = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
    } catch {
      /* déjà arrêté */
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    await cleanupFile(uri);
  }, [recorder, cleanupFile]);

  return {
    supported: true,
    isRecording: recorderState.isRecording,
    isTranscribing,
    durationMs: recorderState.durationMillis ?? 0,
    start: () => void start(),
    stopAndTranscribe: () => void stopAndTranscribe(),
    cancel: () => void cancel(),
  };
}
