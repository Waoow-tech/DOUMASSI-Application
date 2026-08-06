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
import { CornerUpLeft, Mic, Plus, Send, StopCircle, X } from 'lucide-react-native';
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
import { useTranslations } from '@/i18n';

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
  /**
   * Ticket #209 — message en cours de réponse. Affiche un encart sticky au-dessus
   * du composer avec preview du message ciblé + bouton X pour annuler.
   */
  replyingTo?: ReplyingPreview | null;
  /** Appelé quand l'utilisateur tape sur la croix de l'encart de réponse. */
  onCancelReply?: () => void;
  /**
   * Ticket #244 (E7-13) — message pré-rempli dans le composer à l'ouverture
   * de la conversation (typiquement depuis le CTA "Contacter le vendeur"
   * d'une fiche marketplace). Appliqué une seule fois au mount via une key
   * sentinelle pour ne pas écraser le texte que l'utilisateur a déjà
   * commencé à éditer.
   */
  initialContent?: string;
  disabled?: boolean;
  placeholder?: string;
}

export interface ReplyingPreview {
  /** Auteur formaté (`@username` ou "votre message"). */
  authorLabel: string;
  /** 50 premiers caractères du message ciblé (ou label d'attachment). */
  preview: string;
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
  replyingTo,
  onCancelReply,
  initialContent,
  disabled = false,
  placeholder,
}: MessageInputProps) {
  const t = useTranslations();
  const resolvedPlaceholder = placeholder ?? t.messaging.input.placeholder;
  // initialContent appliqué une seule fois au tout premier mount du composant.
  // On utilise useState lazy initializer pour éviter qu'un changement futur
  // de la prop initialContent n'écrase ce que l'utilisateur est en train de
  // taper.
  const [content, setContent] = useState(() => initialContent ?? '');
  const [selection, setSelection] = useState(() => {
    const init = initialContent ?? '';
    return { start: init.length, end: init.length };
  });

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
      {replyingTo ? (
        <XStack
          paddingHorizontal="$3"
          paddingVertical="$2"
          gap="$3"
          alignItems="center"
          backgroundColor="rgba(255,255,255,0.10)"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderColor"
        >
          <CornerUpLeft size={16} color="#FFFFFF" />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={12} color="$accentNeon" fontWeight="700">
              {t.messaging.input.replyingTo(replyingTo.authorLabel)}
            </Text>
            <Text fontSize={13} color="$textSecondary" numberOfLines={1}>
              {replyingTo.preview}
            </Text>
          </YStack>
          {onCancelReply ? (
            <Pressable
              onPress={onCancelReply}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t.messaging.input.cancelReplyA11y}
            >
              <X size={18} color="#A0A0A0" />
            </Pressable>
          ) : null}
        </XStack>
      ) : null}
      <MentionSuggestionsList
        suggestions={suggestions}
        isLoading={isLoading}
        visible={activeQuery !== null}
        onSelect={handleSuggestionPick}
      />
      {tooManyMentions ? (
        <XStack paddingHorizontal="$3" paddingTop="$1">
          <Text fontSize={12} color="$danger">
            {t.messaging.input.tooManyMentions(MAX_MENTIONS_PER_CONTENT)}
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
            {t.messaging.input.recording(recordedSeconds, MAX_VOICE_SECONDS)}
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
            accessibilityLabel={t.messaging.input.addImageA11y}
            accessibilityHint={t.messaging.input.addImageHint}
            accessibilityState={{ disabled: isAttaching || disabled }}
          >
            {isAttaching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
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
          placeholder={resolvedPlaceholder}
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
                    : '#FFFFFF',
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? t.messaging.input.stopRecordingA11y : t.messaging.input.recordVoiceA11y
            }
            accessibilityHint={
              isRecording ? t.messaging.input.stopRecordingHint : t.messaging.input.recordVoiceHint
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
              { backgroundColor: canSend && !disabled ? '#FFFFFF' : '#2A2A2A' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t.messaging.input.sendA11y}
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
