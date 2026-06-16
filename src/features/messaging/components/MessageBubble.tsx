// MessageBubble — E6-03.
//
// Affichage d'un message dans la liste. Bulle à droite si c'est moi, à
// gauche sinon. Gère trois états :
//   - normal : contenu + horodatage relatif
//   - edited : ajoute « modifié » à côté de l'horodatage
//   - deleted : remplace le contenu par « 🚫 Message supprimé » en italique
// Long-press sur ma propre bulle → ouvre la sheet d'actions (parent).

import { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type { MessageRow } from '../hooks/useConversationMessages';

const COLORS = {
  myBubble: '#10D970', // accent neon
  myText: '#000000',
  otherBubble: '#1A1A1A',
  otherText: '#FFFFFF',
  metaText: '#A0A0A0',
  deletedText: '#6B6B6B',
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

const REPLY_PREVIEW_MAX_CHARS = 50;

export interface MessageBubbleProps {
  message: MessageRow;
  isMine: boolean;
  /** Message ciblé par `message.reply_to_id`, déjà résolu par le parent (lookup O(1)). */
  parentMessage?: MessageRow | null;
  /** Libellé auteur du message parent ("Toi" ou le nom de l'autre), pour l'encart de réponse. */
  parentAuthorLabel?: string;
  onLongPress?: (message: MessageRow) => void;
  /** Appelé au tap sur l'encart de réponse, avec l'id du message parent, pour scroller vers lui. */
  onReplyPress?: (parentId: string) => void;
}

function MessageBubbleComponent({
  message,
  isMine,
  parentMessage,
  parentAuthorLabel,
  onLongPress,
  onReplyPress,
}: MessageBubbleProps) {
  const isDeleted = message.deleted_at !== null;
  const isEdited = message.edited_at !== null;
  const isOptimistic = message.id.startsWith('temp-');
  const isFailed = message.id.startsWith('failed-');
  const replyToId = message.reply_to_id;

  const handleLongPress = useCallback(() => {
    if (isDeleted) return;
    onLongPress?.(message);
  }, [isDeleted, onLongPress, message]);

  const handleReplyPreviewPress = useCallback(() => {
    if (replyToId) onReplyPress?.(replyToId);
  }, [replyToId, onReplyPress]);

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
        <YStack gap={2}>
          {replyToId ? (
            <Pressable onPress={handleReplyPreviewPress} disabled={!parentMessage}>
              <YStack
                backgroundColor={isMine ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)'}
                borderRadius={8}
                paddingHorizontal={8}
                paddingVertical={5}
                marginBottom={4}
                borderLeftWidth={3}
                borderLeftColor={isMine ? 'rgba(0,0,0,0.4)' : '#10D970'}
              >
                {parentMessage ? (
                  <Text
                    fontSize={11}
                    fontWeight="700"
                    color={isMine ? 'rgba(0,0,0,0.6)' : '#10D970'}
                  >
                    {parentAuthorLabel ?? ''}
                  </Text>
                ) : null}
                <Text
                  fontSize={12}
                  fontStyle={
                    !parentMessage || parentMessage.deleted_at !== null ? 'italic' : undefined
                  }
                  color={isMine ? 'rgba(0,0,0,0.55)' : COLORS.metaText}
                  numberOfLines={2}
                >
                  {!parentMessage
                    ? 'Message non disponible'
                    : parentMessage.deleted_at !== null
                      ? '🚫 Message supprimé'
                      : (parentMessage.content ?? '').slice(0, REPLY_PREVIEW_MAX_CHARS)}
                </Text>
              </YStack>
            </Pressable>
          ) : null}

          {isDeleted ? (
            <Text
              fontSize={14}
              fontStyle="italic"
              color={isMine ? COLORS.myText : COLORS.deletedText}
            >
              🚫 Message supprimé
            </Text>
          ) : (
            <Text fontSize={15} lineHeight={20} color={isMine ? COLORS.myText : COLORS.otherText}>
              {message.content ?? ''}
            </Text>
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
});

export const MessageBubble = memo(MessageBubbleComponent);
