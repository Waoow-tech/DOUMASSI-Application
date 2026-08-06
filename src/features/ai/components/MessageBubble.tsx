// Bulle de message du chat IA — E5-03.
//
// Utilisateur → alignée à droite, fond accent. Assistant → alignée à gauche,
// fond sombre. Volontairement sobre : pas de Markdown au MVP (E5-03), le
// rendu riche viendra si le besoin se confirme.

import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type { MessageImage } from '@/features/ai/lib/mergeMessages';
import { useTranslations } from '@/i18n';

import { AttachmentImage } from './AttachmentImage';

export interface ChatBubble {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
  images: MessageImage[];
}

const ACCENT = '#FFFFFF';

function MessageBubbleBase({ message }: { message: ChatBubble }) {
  const t = useTranslations();
  const isUser = message.role === 'user';
  const hasImages = message.images.length > 0;

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
        gap={6}
      >
        {!isUser ? (
          <Text fontSize={11} fontWeight="700" color="$textSecondary">
            {t.ai.bubble.assistantLabel}
          </Text>
        ) : null}

        {/* Images jointes (E5-06) — au-dessus du texte */}
        {hasImages ? (
          <YStack gap={6}>
            {message.images.map((image, i) => (
              <AttachmentImage key={image.path ?? image.localUri ?? i} image={image} />
            ))}
          </YStack>
        ) : null}

        {message.content ? (
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
        ) : null}
      </YStack>
    </XStack>
  );
}

export const MessageBubble = memo(MessageBubbleBase, (prev, next) => {
  // Re-render seulement si le contenu, l'état de stream, le rôle ou le nombre
  // d'images changent.
  return (
    prev.message.content === next.message.content &&
    prev.message.streaming === next.message.streaming &&
    prev.message.images.length === next.message.images.length &&
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
