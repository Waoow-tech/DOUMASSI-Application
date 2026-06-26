// MessageInput — E6-03 / E6-05 + ticket #213 PR B (mentions composer).
//
// Composant sticky bottom : input multiline (max 6 lignes) + bouton Send.
// Quand l'utilisateur tape `@`, ouvre une dropdown de suggestions au-dessus
// du TextArea. Tap sur une suggestion insère `@username ` à la position du
// curseur.
//
// Send désactivé si vide, whitespace only, ou > 5 mentions dans le message.

import { Send } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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
      <XStack
        alignItems="flex-end"
        gap="$2"
        paddingHorizontal="$3"
        paddingTop="$2"
        paddingBottom="$2"
      >
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
