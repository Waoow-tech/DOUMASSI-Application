// Bulle de message du chat IA — E5-03.
//
// Utilisateur → alignée à droite, fond accent. Assistant → alignée à gauche,
// fond sombre. Volontairement sobre : pas de Markdown au MVP (E5-03), le
// rendu riche viendra si le besoin se confirme.

import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

export interface ChatBubble {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
}

const ACCENT = '#10D970';

function MessageBubbleBase({ message }: { message: ChatBubble }) {
  const t = useTranslations();
  const isUser = message.role === 'user';

  return (
    <XStack
      width="100%"
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      paddingHorizontal={16}
      paddingVertical={5}
    >
      <YStack
        maxWidth="82%"
        backgroundColor={isUser ? ACCENT : '$surface'}
        borderRadius={18}
        borderBottomRightRadius={isUser ? 4 : 18}
        borderBottomLeftRadius={isUser ? 18 : 4}
        paddingHorizontal={14}
        paddingVertical={10}
        gap={2}
      >
        {!isUser ? (
          <Text fontSize={11} fontWeight="700" color="$textSecondary">
            {t.ai.bubble.assistantLabel}
          </Text>
        ) : null}
        <Text
          fontSize={15}
          lineHeight={21}
          color={isUser ? '#000000' : '$color'}
          selectable
          accessibilityLabel={message.content}
        >
          {message.content}
          {/* Curseur clignotant textuel pendant le stream : léger, sans
              dépendance d'animation, et il disparaît dès l'arrêt du flux. */}
          {message.streaming ? <Text color="$textSecondary">▋</Text> : null}
        </Text>
      </YStack>
    </XStack>
  );
}

export const MessageBubble = memo(MessageBubbleBase, (prev, next) => {
  // Re-render seulement si le contenu, l'état de stream ou le rôle changent.
  return (
    prev.message.content === next.message.content &&
    prev.message.streaming === next.message.streaming &&
    prev.message.role === next.message.role
  );
});

/** Bulle « frappe… » affichée avant le premier fragment. */
function TypingBubbleBase() {
  const t = useTranslations();
  return (
    <XStack width="100%" justifyContent="flex-start" paddingHorizontal={16} paddingVertical={5}>
      <YStack
        backgroundColor="$surface"
        borderRadius={18}
        borderBottomLeftRadius={4}
        paddingHorizontal={14}
        paddingVertical={10}
      >
        <Text fontSize={13} color="$textSecondary" style={styles.italic}>
          {t.ai.bubble.typing}
        </Text>
      </YStack>
    </XStack>
  );
}

export const TypingBubble = memo(TypingBubbleBase);

const styles = StyleSheet.create({
  italic: { fontStyle: 'italic' },
});
