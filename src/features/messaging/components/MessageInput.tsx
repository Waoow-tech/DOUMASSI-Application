// MessageInput — E6-03 / E6-05.
//
// Composant sticky bottom : input multiline (max 6 lignes) + bouton Send.
// Send désactivé si vide ou whitespace only.

import { Send } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { TextArea, XStack, YStack } from 'tamagui';

export interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LINES = 6;
const MAX_CONTENT_LENGTH = 4000;

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Écrire un message…',
}: MessageInputProps) {
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CONTENT_LENGTH;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setContent('');
  }, [canSend, onSend, trimmed]);

  return (
    <YStack
      backgroundColor="$surface"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderColor"
      paddingHorizontal="$3"
      paddingTop="$2"
      paddingBottom="$2"
    >
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
