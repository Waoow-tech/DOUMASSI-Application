// MessageInput — E6-03 / E6-05.
//
// Composant sticky bottom : input multiline (max 6 lignes) + bouton Send.
// Send désactivé si vide ou whitespace only.

import { Send, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';

import type { MessageRow } from '../hooks/useConversationMessages';

export interface MessageInputProps {
  onSend: (content: string, replyToId?: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Message ciblé par une réponse en cours (E6-06), affiché dans l'encart au-dessus. */
  replyTo?: MessageRow | null;
  /** Libellé auteur du message ciblé ("Toi" ou le nom de l'autre). */
  replyToAuthorLabel?: string;
  onCancelReply?: () => void;
}

const MAX_LINES = 6;
const MAX_CONTENT_LENGTH = 4000;

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Écrire un message…',
  replyTo = null,
  replyToAuthorLabel,
  onCancelReply,
}: MessageInputProps) {
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CONTENT_LENGTH;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed, replyTo?.id ?? null);
    setContent('');
  }, [canSend, onSend, trimmed, replyTo]);

  return (
    <YStack
      backgroundColor="$surface"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderColor"
      paddingHorizontal="$3"
      paddingTop="$2"
      paddingBottom="$2"
    >
      {replyTo ? (
        <XStack
          backgroundColor="$background"
          borderRadius={10}
          paddingHorizontal={10}
          paddingVertical={6}
          marginBottom="$2"
          alignItems="center"
          gap="$2"
          borderLeftWidth={3}
          borderLeftColor="$accentNeon"
        >
          <YStack flex={1}>
            <Text fontSize={11} color="$accentNeon" fontWeight="700">
              Réponse{replyToAuthorLabel ? ` à ${replyToAuthorLabel}` : ''}
            </Text>
            <Text fontSize={13} color="$textSecondary" numberOfLines={1}>
              {replyTo.deleted_at !== null ? '🚫 Message supprimé' : (replyTo.content ?? '')}
            </Text>
          </YStack>
          <Pressable
            onPress={onCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Annuler la réponse"
          >
            <X size={16} color="#6B6B6B" />
          </Pressable>
        </XStack>
      ) : null}

      <XStack alignItems="flex-end" gap="$2">
        <TextArea
          flex={1}
          value={content}
          onChangeText={(text) => setContent(text.slice(0, MAX_CONTENT_LENGTH))}
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
      </XStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
