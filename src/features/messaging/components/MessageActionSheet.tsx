// MessageActionSheet — E6-03 + #209 (Répondre).
//
// Sheet contextuel ouvert au long-press sur une bulle. Selon le message et
// la prop reçue, propose :
//   - Répondre (toutes bulles non supprimées, si `onReply` fourni)
//   - Modifier (seulement mes bulles texte)
//   - Supprimer (seulement mes bulles)
//
// Édition : passe en mode `editing` qui remplace le menu par un input
// pré-rempli + bouton de validation.

import { CornerUpLeft, Edit3, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Button, Sheet, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import type { MessageRow } from '../hooks/useConversationMessages';

export interface MessageActionSheetProps {
  message: MessageRow | null;
  /** Vrai si le message ciblé est de l'user courant (active Modifier/Supprimer). */
  isMine?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  /** Ticket #209 — option "Répondre" en tête du menu. Appelle setReplyTo côté parent. */
  onReply?: (message: MessageRow) => void;
  editIsPending?: boolean;
  deleteIsPending?: boolean;
}

const MAX_CONTENT_LENGTH = 4000;

export function MessageActionSheet({
  message,
  isMine = false,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onReply,
  editIsPending = false,
  deleteIsPending = false,
}: MessageActionSheetProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<'menu' | 'editing'>('menu');
  const [editingContent, setEditingContent] = useState('');

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) {
      setMode('menu');
      setEditingContent(message?.content ?? '');
    }
  }, [open, message]);

  const isText = message?.attachment_type === 'text';
  const isDeleted = message?.deleted_at != null;
  const canEdit = isMine && isText && message?.content;
  const canDelete = isMine && !isDeleted;
  const canReply = !!onReply && !isDeleted && message != null;

  const handleReply = useCallback(() => {
    if (!message || !onReply) return;
    onReply(message);
    onOpenChange(false);
  }, [message, onOpenChange, onReply]);

  const handleStartEdit = useCallback(() => {
    if (!message?.content) return;
    setEditingContent(message.content);
    setMode('editing');
  }, [message]);

  const handleSaveEdit = useCallback(async () => {
    if (!message) return;
    const trimmed = editingContent.trim();
    if (trimmed.length === 0) {
      Alert.alert(
        t.messaging.actionSheet.emptyContentTitle,
        t.messaging.actionSheet.emptyContentMessage
      );
      return;
    }
    try {
      await onEdit(message.id, trimmed);
      onOpenChange(false);
    } catch (e) {
      Alert.alert(
        t.messaging.actionSheet.editFailedTitle,
        e instanceof Error ? e.message : t.messaging.actionSheet.retryLater
      );
    }
  }, [message, editingContent, onEdit, onOpenChange, t]);

  const handleDelete = useCallback(() => {
    if (!message) return;
    Alert.alert(
      t.messaging.actionSheet.deleteConfirmTitle,
      t.messaging.actionSheet.deleteConfirmMessage,
      [
        { text: t.messaging.common.cancel, style: 'cancel' },
        {
          text: t.messaging.actionSheet.deleteAction,
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(message.id);
              onOpenChange(false);
            } catch (e) {
              Alert.alert(
                t.messaging.actionSheet.deleteFailedTitle,
                e instanceof Error ? e.message : t.messaging.actionSheet.retryLater
              );
            }
          },
        },
      ]
    );
  }, [message, onDelete, onOpenChange, t]);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={mode === 'editing' ? [60] : [30]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.6)" />
      <Sheet.Frame
        backgroundColor="$surface"
        borderTopLeftRadius={16}
        borderTopRightRadius={16}
        padding="$4"
        gap="$3"
      >
        <Sheet.Handle backgroundColor="$borderColor" />

        {mode === 'menu' ? (
          <YStack gap="$2">
            {canReply ? (
              <Pressable
                onPress={handleReply}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={t.messaging.actionSheet.replyA11y}
              >
                <CornerUpLeft size={20} color="#FFFFFF" />
                <Text color="$color" fontSize={16}>
                  {t.messaging.actionSheet.reply}
                </Text>
              </Pressable>
            ) : null}
            {canEdit ? (
              <Pressable
                onPress={handleStartEdit}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={t.messaging.actionSheet.editA11y}
              >
                <Edit3 size={20} color="#FFFFFF" />
                <Text color="$color" fontSize={16}>
                  {t.messaging.actionSheet.edit}
                </Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                onPress={handleDelete}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={t.messaging.actionSheet.deleteA11y}
              >
                {deleteIsPending ? (
                  <Spinner color="#FF3B30" />
                ) : (
                  <Trash2 size={20} color="#FF3B30" />
                )}
                <Text color="$danger" fontSize={16} fontWeight="600">
                  {t.messaging.actionSheet.delete}
                </Text>
              </Pressable>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$3">
            <Text color="$textSecondary" fontSize={12} fontWeight="700" textTransform="uppercase">
              {t.messaging.actionSheet.editHeader}
            </Text>
            <TextArea
              value={editingContent}
              onChangeText={(text) => setEditingContent(text.slice(0, MAX_CONTENT_LENGTH))}
              placeholder={t.messaging.actionSheet.editPlaceholder}
              placeholderTextColor="$placeholderColor"
              backgroundColor="$background"
              borderColor="$borderColor"
              borderWidth={1}
              borderRadius={12}
              color="$color"
              fontSize={15}
              minHeight={90}
              padding="$3"
              multiline
              autoFocus
            />
            <XStack gap="$3">
              <Button
                flex={1}
                onPress={() => setMode('menu')}
                backgroundColor="transparent"
                borderColor="$borderColor"
                borderWidth={1}
                color="$color"
                borderRadius={12}
                height={44}
                fontWeight="600"
              >
                {t.messaging.common.cancel}
              </Button>
              <Button
                flex={1}
                onPress={() => void handleSaveEdit()}
                disabled={editIsPending || editingContent.trim().length === 0}
                backgroundColor="$accentNeon"
                color="#000000"
                borderRadius={12}
                height={44}
                fontWeight="800"
                opacity={editIsPending || editingContent.trim().length === 0 ? 0.5 : 1}
              >
                {editIsPending ? <Spinner color="#000000" /> : t.messaging.actionSheet.save}
              </Button>
            </XStack>
          </YStack>
        )}
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
});
