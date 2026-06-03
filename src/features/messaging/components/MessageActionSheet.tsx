// MessageActionSheet — E6-03.
//
// Sheet contextuel qui s'ouvre au long-press sur une bulle "à moi".
// Propose : Modifier (texte seulement), Supprimer.
// Édition : passe en mode `editing` qui remplace le sheet par un input
// pré-rempli + bouton de validation.

import { Edit3, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Button, Sheet, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';

import type { MessageRow } from '../hooks/useConversationMessages';

export interface MessageActionSheetProps {
  message: MessageRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  editIsPending?: boolean;
  deleteIsPending?: boolean;
}

const MAX_CONTENT_LENGTH = 4000;

export function MessageActionSheet({
  message,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  editIsPending = false,
  deleteIsPending = false,
}: MessageActionSheetProps) {
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
  const canEdit = isText && message?.content;

  const handleStartEdit = useCallback(() => {
    if (!message?.content) return;
    setEditingContent(message.content);
    setMode('editing');
  }, [message]);

  const handleSaveEdit = useCallback(async () => {
    if (!message) return;
    const trimmed = editingContent.trim();
    if (trimmed.length === 0) {
      Alert.alert('Contenu vide', 'Le message ne peut pas être vide.');
      return;
    }
    try {
      await onEdit(message.id, trimmed);
      onOpenChange(false);
    } catch (e) {
      Alert.alert(
        'Édition impossible',
        e instanceof Error ? e.message : 'Réessayez dans un instant.'
      );
    }
  }, [message, editingContent, onEdit, onOpenChange]);

  const handleDelete = useCallback(() => {
    if (!message) return;
    Alert.alert(
      'Supprimer ce message ?',
      'Le contenu sera remplacé par « Message supprimé » pour tous les participants. Action irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(message.id);
              onOpenChange(false);
            } catch (e) {
              Alert.alert(
                'Suppression impossible',
                e instanceof Error ? e.message : 'Réessayez dans un instant.'
              );
            }
          },
        },
      ]
    );
  }, [message, onDelete, onOpenChange]);

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
            {canEdit ? (
              <Pressable onPress={handleStartEdit} style={styles.row}>
                <Edit3 size={20} color="#FFFFFF" />
                <Text color="$color" fontSize={16}>
                  Modifier
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={handleDelete} style={styles.row}>
              {deleteIsPending ? <Spinner color="#FF3B30" /> : <Trash2 size={20} color="#FF3B30" />}
              <Text color="$danger" fontSize={16} fontWeight="600">
                Supprimer
              </Text>
            </Pressable>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Text color="$textSecondary" fontSize={12} fontWeight="700" textTransform="uppercase">
              Modifier le message
            </Text>
            <TextArea
              value={editingContent}
              onChangeText={(text) => setEditingContent(text.slice(0, MAX_CONTENT_LENGTH))}
              placeholder="Tape ton message…"
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
                Annuler
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
                {editIsPending ? <Spinner color="#000000" /> : 'Enregistrer'}
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
