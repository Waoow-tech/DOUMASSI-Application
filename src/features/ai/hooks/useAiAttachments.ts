// Gestion des pièces jointes image du chat IA — E5-06.
//
// Sélection + upload dans le bucket privé ai-attachments, avec état par image
// (uploading / done / failed). L'écran consomme `refs` (pour l'envoi) et `uris`
// (pour l'affichage optimiste).

import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';
import { uploadAiImage } from '@/lib/storage';

import type { AiAttachmentRef } from '../lib/streamAiChat';

/** Nombre max de photos par message (aligné sur le garde-fou serveur). */
export const MAX_AI_ATTACHMENTS = 4;

export interface AiAttachment {
  /** URI locale — sert d'identifiant et d'aperçu. */
  localUri: string;
  /** Path dans le bucket, une fois l'upload terminé. */
  path?: string;
  status: 'uploading' | 'done' | 'failed';
}

export function useAiAttachments() {
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);

  const update = useCallback((localUri: string, patch: Partial<AiAttachment>) => {
    setAttachments((prev) => prev.map((a) => (a.localUri === localUri ? { ...a, ...patch } : a)));
  }, []);

  const uploadOne = useCallback(
    async (localUri: string) => {
      try {
        const { path } = await uploadAiImage(localUri);
        update(localUri, { path, status: 'done' });
      } catch (err) {
        logger.warn('ai_attachment_upload_failed', {
          message: err instanceof Error ? err.message : String(err),
        });
        update(localUri, { status: 'failed' });
      }
    },
    [update]
  );

  const pickAndUpload = useCallback(async () => {
    const t = getT().ai.attach;

    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.permissionTitle, t.permissionMessage);
      return;
    }

    // On borne la sélection à la place restante.
    const remaining = MAX_AI_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      Alert.alert(t.tooMany(MAX_AI_ATTACHMENTS));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1, // compression côté uploadAiImage
    });
    if (result.canceled) return;

    const newItems: AiAttachment[] = result.assets
      .filter((a) => !attachments.some((existing) => existing.localUri === a.uri))
      .slice(0, remaining)
      .map((a) => ({ localUri: a.uri, status: 'uploading' as const }));

    if (newItems.length === 0) return;
    setAttachments((prev) => [...prev, ...newItems]);
    // Uploads en parallèle.
    await Promise.all(newItems.map((item) => uploadOne(item.localUri)));
  }, [attachments, uploadOne]);

  const remove = useCallback((localUri: string) => {
    setAttachments((prev) => prev.filter((a) => a.localUri !== localUri));
  }, []);

  const clear = useCallback(() => setAttachments([]), []);

  const isUploading = attachments.some((a) => a.status === 'uploading');

  /** Refs prêtes pour l'envoi (uniquement les uploads réussis). */
  const refs: AiAttachmentRef[] = attachments
    .filter((a) => a.status === 'done' && a.path)
    .map((a) => ({ path: a.path as string, kind: 'image' }));

  const uris = attachments.map((a) => a.localUri);

  return { attachments, pickAndUpload, remove, clear, isUploading, refs, uris };
}
