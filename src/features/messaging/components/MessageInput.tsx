// MessageInput — E6-03 / E6-05 + ticket #213 PR B (mentions composer)
//                + ticket #210 (image attachment) + #211 (voice attachment).
//
// Composant sticky bottom : input multiline (max 6 lignes) + bouton Send.
// Quand l'utilisateur tape `@`, ouvre une dropdown de suggestions au-dessus
// du TextArea. Tap sur une suggestion insère `@username ` à la position du
// curseur. Le bouton "+" à gauche ouvre le picker d'image (le parent gère
// le choix Galerie/Caméra via `onAttach`).
// Quand l'input est vide ET `onSendVoice` est fourni, un bouton micro
// remplace le bouton Send : tap → start recording, tap encore → stop +
// upload + send.
//
// Send désactivé si vide, whitespace only, ou > 5 mentions dans le message.

import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { Mic, Plus, Send, StopCircle } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';

import { MentionSuggestionsList } from '@/features/mentions/components/MentionSuggestionsList';
import { useMentionSuggestions } from '@/features/mentions/hooks/useMentionSuggestions';
import {
  countMentions,
  MAX_MENTIONS_PER_CONTENT,
} from '@/features/mentions/schemas/mentionsSchema';
import type { SearchUserResult } from '@/features/profile/hooks/useSearchUsers';

export interface MessageInputProps {
  onSend: (content: string) => void;
  /**
   * Ouvre le picker d'image (Galerie/Caméra). Le parent doit gérer le choix
   * + l'appel à `uploadMessageImage` + `useSendMessage` avec attachmentType.
   */
  onAttach?: () => void;
  /** Vrai pendant l'upload d'une image — désactive le bouton et affiche un spinner. */
  isAttaching?: boolean;
  /**
   * Callback appelé après l'arrêt d'un enregistrement. Le parent doit upload
   * le fichier audio + créer le message avec attachmentType='voice'.
   */
  onSendVoice?: (uri: string, durationSeconds: number) => Promise<void> | void;
  /** Vrai pendant l'upload/send vocal — bloque toute autre interaction. */
  isSendingVoice?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LINES = 6;
const MAX_CONTENT_LENGTH = 4000;

const MAX_VOICE_SECONDS = 60;

export function MessageInput({
  onSend,
  onAttach,
  isAttaching = false,
  onSendVoice,
  isSendingVoice = false,
  disabled = false,
  placeholder = 'Écrire un message…',
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const { activeQuery, suggestions, isLoading, replaceMention } = useMentionSuggestions(
    content,
    selection.end
  );

  const trimmed = content.trim();
  const mentionsCount = useMemo(() => countMentions(content), [content]);
  const tooManyMentions = mentionsCount > MAX_MENTIONS_PER_CONTENT;
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CONTENT_LENGTH && !tooManyMentions;

  const handleChangeText = useCallback((text: string) => {
    setContent(text.slice(0, MAX_CONTENT_LENGTH));
  }, []);

  const handleSelectionChange = useCallback(
    (event: { nativeEvent: { selection: { start: number; end: number } } }) => {
      setSelection(event.nativeEvent.selection);
    },
    []
  );

  const handleSuggestionPick = useCallback(
    (user: SearchUserResult) => {
      const next = replaceMention(user.username);
      setContent(next.text);
      setSelection({ start: next.cursor, end: next.cursor });
    },
    [replaceMention]
  );

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setContent('');
    setSelection({ start: 0, end: 0 });
  }, [canSend, onSend, trimmed]);

  // Ticket #211 — enregistrement vocal.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recordStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick UI 1Hz pendant l'enregistrement + auto-stop à 60s
  useEffect(() => {
    if (!isRecording) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(() => {
      const start = recordStartRef.current;
      if (start == null) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setRecordedSeconds(elapsed);
      if (elapsed >= MAX_VOICE_SECONDS) {
        // Auto-stop : déclenche via setIsRecording(false) côté useEffect.
        void stopRecording(true);
      }
    }, 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordStartRef.current = Date.now();
      setRecordedSeconds(0);
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  }, [recorder]);

  const stopRecording = useCallback(
    async (autoStop = false): Promise<void> => {
      if (!isRecording) return;
      try {
        await recorder.stop();
      } catch {
        // best effort
      }
      const duration = recordStartRef.current
        ? Math.max(1, Math.floor((Date.now() - recordStartRef.current) / 1000))
        : 1;
      setIsRecording(false);
      recordStartRef.current = null;

      const uri = recorder.uri;
      if (uri && onSendVoice) {
        try {
          await onSendVoice(uri, Math.min(duration, MAX_VOICE_SECONDS));
        } catch {
          // l'erreur a déjà été remontée par le parent (Alert)
        }
      }
      // autoStop = true → on évite un double appel via le timer
      void autoStop;
    },
    [isRecording, onSendVoice, recorder]
  );

  const handleMicPress = useCallback(() => {
    if (isSendingVoice || disabled) return;
    if (isRecording) void stopRecording();
    else void startRecording();
  }, [disabled, isRecording, isSendingVoice, startRecording, stopRecording]);

  // Le bouton mic remplace Send quand input vide ET callback voice fourni
  const showMicButton = onSendVoice !== undefined && trimmed.length === 0;

  return (
    <YStack
      backgroundColor="$surface"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderColor"
    >
      <MentionSuggestionsList
        suggestions={suggestions}
        isLoading={isLoading}
        visible={activeQuery !== null}
        onSelect={handleSuggestionPick}
      />
      {tooManyMentions ? (
        <XStack paddingHorizontal="$3" paddingTop="$1">
          <Text fontSize={12} color="$danger">
            Maximum {MAX_MENTIONS_PER_CONTENT} mentions par message.
          </Text>
        </XStack>
      ) : null}
      {isRecording ? (
        <XStack
          paddingHorizontal="$3"
          paddingVertical="$2"
          alignItems="center"
          gap="$2"
          backgroundColor="rgba(255,59,48,0.12)"
        >
          <YStack width={8} height={8} borderRadius={4} backgroundColor="#FF3B30" />
          <Text fontSize={13} color="$color" fontWeight="600">
            Enregistrement… {recordedSeconds}s / {MAX_VOICE_SECONDS}s
          </Text>
        </XStack>
      ) : null}
      <XStack
        alignItems="flex-end"
        gap="$2"
        paddingHorizontal="$3"
        paddingTop="$2"
        paddingBottom="$2"
      >
        {onAttach ? (
          <Pressable
            onPress={onAttach}
            disabled={isAttaching || disabled}
            style={[
              styles.attachButton,
              { backgroundColor: isAttaching || disabled ? '#2A2A2A' : '#1A1A1A' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une image"
            accessibilityHint="Tap pour ouvrir la galerie ou prendre une photo"
            accessibilityState={{ disabled: isAttaching || disabled }}
          >
            {isAttaching ? (
              <ActivityIndicator size="small" color="#10D970" />
            ) : (
              <Plus size={22} color="#FFFFFF" />
            )}
          </Pressable>
        ) : null}
        <TextArea
          flex={1}
          value={content}
          selection={selection}
          onChangeText={handleChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor="$placeholderColor"
          backgroundColor="$background"
          borderColor="$borderColor"
          borderWidth={1}
          borderRadius={18}
          color="$color"
          fontSize={15}
          paddingHorizontal={14}
          paddingVertical={8}
          minHeight={40}
          maxHeight={20 * MAX_LINES}
          editable={!disabled}
          multiline
        />
        {showMicButton ? (
          <Pressable
            onPress={handleMicPress}
            disabled={isSendingVoice || disabled}
            style={[
              styles.sendButton,
              {
                backgroundColor: isRecording
                  ? '#FF3B30'
                  : isSendingVoice || disabled
                    ? '#2A2A2A'
                    : '#10D970',
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? "Arrêter l'enregistrement" : 'Enregistrer un vocal'}
            accessibilityHint={
              isRecording
                ? "Tap pour arrêter et envoyer l'enregistrement"
                : 'Tap pour commencer un enregistrement vocal'
            }
            accessibilityState={{ disabled: isSendingVoice || disabled }}
          >
            {isSendingVoice ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isRecording ? (
              <StopCircle size={22} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Mic size={20} color="#000000" />
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSend}
            disabled={!canSend || disabled}
            style={[
              styles.sendButton,
              { backgroundColor: canSend && !disabled ? '#10D970' : '#2A2A2A' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
            accessibilityState={{ disabled: !canSend || disabled }}
          >
            <Send size={20} color={canSend && !disabled ? '#000000' : '#6B6B6B'} />
          </Pressable>
        )}
      </XStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
