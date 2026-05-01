// Hook dédié à la sélection et l'upload d'avatar vers Supabase Storage.
// Séparé de useSignup pour respecter le principe de responsabilité unique.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function useAvatarPicker() {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  /**
   * Ouvre le sélecteur d'images (galerie) pour choisir un avatar.
   * Crop carré 1:1, qualité 0.8 pour limiter la taille.
   */
  const pickAvatar = async () => {
    const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn("Permission galerie refusée par l'utilisateur");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setAvatarUri(asset.uri);
    } catch (err) {
      logger.error('[AVATAR] Erreur launchImageLibraryAsync:', err);
    }
  };

  /**
   * Upload l'avatar vers Supabase Storage (bucket "avatars").
   * Retourne l'URL publique ou undefined si pas d'avatar / échec.
   */
  const uploadAvatar = async (userId: string): Promise<string | undefined> => {
    if (!avatarUri) return undefined;

    try {
      const fileInfo = await FileSystem.getInfoAsync(avatarUri);
      if (!fileInfo.exists) {
        logger.warn("[UPLOAD] Fichier introuvable à l'URI:", avatarUri);
        return undefined;
      }

      const ext = avatarUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const contentType = validExt === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${userId}/avatar.${validExt}`;

      const base64 = await FileSystem.readAsStringAsync(avatarUri, {
        encoding: 'base64',
      });

      if (!base64) return undefined;

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        logger.error('[UPLOAD] Erreur upload:', uploadError.message);
        return undefined;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      logger.error('[UPLOAD] Erreur inattendue uploadAvatar:', err);
      return undefined;
    }
  };

  return { avatarUri, pickAvatar, uploadAvatar };
}
