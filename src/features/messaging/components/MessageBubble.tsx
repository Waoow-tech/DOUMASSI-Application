// MessageBubble — E6-03 + ticket #210 (image) + #211 (voice) + #209 (reply).
//
// Affichage d'un message dans la liste. Bulle à droite si c'est moi, à
// gauche sinon. Gère plusieurs états :
//   - normal : contenu texte + horodatage relatif
//   - edited : ajoute « modifié » à côté de l'horodatage
//   - deleted : remplace le contenu par « 🚫 Message supprimé » en italique
//   - image : thumbnail 220×260 contentFit cover, caption optionnel dessous
//   - voice : mini player Play/Pause + durée
//   - reply : encart cliquable au-dessus du contenu avec auteur + preview
//     du message parent. Tap → onReplyPress(parentId) (le parent scroll).
//
// Long-press sur N'IMPORTE QUELLE bulle non-supprimée → ouvre la sheet
// d'actions (le parent gère l'affichage conditionnel selon `isMine`).

import { Image } from 'expo-image';
import { CornerUpLeft } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { MentionsText } from '@/components/MentionsText';

import type { MessageRow } from '../hooks/useConversationMessages';

import { VoiceMessage } from './VoiceMessage';

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

export interface ReplyParentPreview {
  /** ID du parent (utilisé pour scroll). */
  id: string;
  /** Auteur formaté (`@username` ou "votre message"). */
  authorLabel: string;
  /** Texte preview (50 char), ou label d'attachment ("Photo", "Vocal"). */
  preview: string;
  /** Vrai si le parent est soft-deleted → l'encart affiche "Message supprimé". */
  isDeleted: boolean;
}

export interface MessageBubbleProps {
  message: MessageRow;
  isMine: boolean;
  /**
   * Preview du message parent si `message.reply_to_id !== null`. Le parent
   * (ConversationScreen) doit le résoudre en cherchant dans la liste flat.
   */
  replyParent?: ReplyParentPreview | null;
  /** Tap sur l'encart de réponse → scroll vers le parent. */
  onReplyPress?: (parentMessageId: string) => void;
  onLongPress?: (message: MessageRow) => void;
}

function MessageBubbleComponent({
  message,
  isMine,
  replyParent,
  onReplyPress,
  onLongPress,
}: MessageBubbleProps) {
  const isDeleted = message.deleted_at !== null;
  const isEdited = message.edited_at !== null;
  const isOptimistic = message.id.startsWith('temp-');
  const isFailed = message.id.startsWith('failed-');

  // #209 — long-press autorisé sur TOUTES les bulles non supprimées (pas
  // juste les miennes), pour permettre "Répondre" sur les messages des autres.
  const handleLongPress = useCallback(() => {
    if (isDeleted || isOptimistic || isFailed) return;
    onLongPress?.(message);
  }, [isDeleted, isOptimistic, isFailed, onLongPress, message]);

  const handleReplyPress = useCallback(() => {
    if (!message.reply_to_id || !onReplyPress) return;
    onReplyPress(message.reply_to_id);
  }, [message.reply_to_id, onReplyPress]);

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
          {message.reply_to_id && replyParent ? (
            <Pressable
              onPress={handleReplyPress}
              accessibilityRole="button"
              accessibilityLabel={`Aller au message de ${replyParent.authorLabel}`}
              style={[
                styles.replyEmbed,
                {
                  backgroundColor: isMine ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)',
                  borderLeftColor: isMine ? '#000000' : '#10D970',
                },
              ]}
            >
              <XStack alignItems="center" gap={6}>
                <CornerUpLeft size={12} color={isMine ? '#000000' : '#10D970'} />
                <Text fontSize={12} fontWeight="700" color={isMine ? COLORS.myText : '#10D970'}>
                  {replyParent.authorLabel}
                </Text>
              </XStack>
              <Text
                fontSize={13}
                color={
                  replyParent.isDeleted
                    ? isMine
                      ? 'rgba(0,0,0,0.5)'
                      : COLORS.deletedText
                    : isMine
                      ? 'rgba(0,0,0,0.75)'
                      : COLORS.metaText
                }
                fontStyle={replyParent.isDeleted ? 'italic' : 'normal'}
                numberOfLines={2}
              >
                {replyParent.isDeleted ? '🚫 Message supprimé' : replyParent.preview}
              </Text>
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
              {message.attachment_type === 'voice' && message.attachment_url ? (
                <VoiceMessage
                  audioUrl={message.attachment_url}
                  durationSeconds={
                    message.content ? Number.parseInt(message.content, 10) || undefined : undefined
                  }
                  textColor={isMine ? COLORS.myText : COLORS.otherText}
                  iconColor={isMine ? COLORS.myText : '#10D970'}
                />
              ) : null}
              {message.attachment_type !== 'voice' && message.content ? (
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
  replyEmbed: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    gap: 2,
    marginBottom: 2,
  },
});

export const MessageBubble = memo(MessageBubbleComponent);
