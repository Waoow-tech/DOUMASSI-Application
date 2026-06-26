// MessageBubble — E6-03 + ticket #210 (image attachment).
//
// Affichage d'un message dans la liste. Bulle à droite si c'est moi, à
// gauche sinon. Gère plusieurs états :
//   - normal : contenu texte + horodatage relatif
//   - edited : ajoute « modifié » à côté de l'horodatage
//   - deleted : remplace le contenu par « 🚫 Message supprimé » en italique
//   - image : affiche une thumbnail 220×260 contentFit cover, content
//     optionnel rendu en dessous (caption)
// Long-press sur ma propre bulle → ouvre la sheet d'actions (parent).

import { Image } from 'expo-image';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { MentionsText } from '@/components/MentionsText';

import type { MessageRow } from '../hooks/useConversationMessages';

const COLORS = {
  myBubble: '#10D970', // accent neon
  myText: '#000000',
  otherBubble: '#1A1A1A',
  otherText: '#FFFFFF',
  metaText: '#A0A0A0',
  // #8A8A8A pour atteindre ratio WCAG AA ≥ 4.5:1 sur otherBubble (#1A1A1A).
  // Ticket #215.
  deletedText: '#8A8A8A',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Format HH:MM pour les messages du jour. Pour la bêta on garde simple.
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface MessageBubbleProps {
  message: MessageRow;
  isMine: boolean;
  onLongPress?: (message: MessageRow) => void;
}

function MessageBubbleComponent({ message, isMine, onLongPress }: MessageBubbleProps) {
  const isDeleted = message.deleted_at !== null;
  const isEdited = message.edited_at !== null;
  const isOptimistic = message.id.startsWith('temp-');
  const isFailed = message.id.startsWith('failed-');

  const handleLongPress = useCallback(() => {
    if (!isMine || isDeleted) return;
    onLongPress?.(message);
  }, [isMine, isDeleted, onLongPress, message]);

  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical={3}
      justifyContent={isMine ? 'flex-end' : 'flex-start'}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? COLORS.myBubble : COLORS.otherBubble,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            opacity: isOptimistic || isFailed ? 0.6 : 1,
          },
        ]}
      >
        <YStack gap={6}>
          {isDeleted ? (
            <Text
              fontSize={14}
              fontStyle="italic"
              color={isMine ? COLORS.myText : COLORS.deletedText}
            >
              🚫 Message supprimé
            </Text>
          ) : (
            <>
              {message.attachment_type === 'image' && message.attachment_url ? (
                <Image
                  source={{ uri: message.attachment_url }}
                  style={styles.imageAttachment}
                  contentFit="cover"
                  transition={150}
                  recyclingKey={message.id}
                  accessibilityLabel="Image envoyée"
                />
              ) : null}
              {message.content ? (
                <MentionsText
                  content={message.content}
                  style={{
                    fontSize: 15,
                    lineHeight: 20,
                    color: isMine ? COLORS.myText : COLORS.otherText,
                  }}
                  mentionColor={isMine ? COLORS.myText : '#10D970'}
                  mentionUnderline={isMine}
                />
              ) : null}
            </>
          )}

          <XStack gap={4} alignItems="center" justifyContent="flex-end">
            {isFailed ? (
              <Text fontSize={11} color="#FF3B30" fontWeight="600">
                Échec — taper pour réessayer
              </Text>
            ) : (
              <>
                {isEdited && !isDeleted ? (
                  <Text
                    fontSize={11}
                    color={isMine ? 'rgba(0,0,0,0.55)' : COLORS.metaText}
                    fontStyle="italic"
                  >
                    modifié
                  </Text>
                ) : null}
                <Text fontSize={11} color={isMine ? 'rgba(0,0,0,0.55)' : COLORS.metaText}>
                  {formatTime(message.created_at)}
                </Text>
              </>
            )}
          </XStack>
        </YStack>
      </Pressable>
    </XStack>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  imageAttachment: {
    width: 220,
    height: 260,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
});

export const MessageBubble = memo(MessageBubbleComponent);
