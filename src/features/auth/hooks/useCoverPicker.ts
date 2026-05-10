// Hook for picking and uploading a cover photo (banner image) to Supabase Storage.
// Pattern copié de useAvatarPicker mais avec :
//   - ratio 3:1 (paysage type bannière, 1500×500px recommandé)
//   - compression cible <400Ko (vs 200Ko pour l'avatar)
//   - bucket Supabase distinct : `covers/{user_id}.jpg`
//
// Ticket E2-10 — Sprint 1 Auth & Onboarding.

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function useCoverPicker() {
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Resize to max 1500×500 (ratio 3:1), compress jusqu'à < 400 Ko.
   * Fallback à l'URI original si la manipulation échoue.
   */
  const processImage = async (uri: string) => {
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1500, height: 500 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (fileInfo.exists && fileInfo.size > 400 * 1024) {
        // Encore trop lourd → 2e passe de compression
        const compressed = await ImageManipulator.manipulateAsync(result.uri, [], {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        setCoverUri(compressed.uri);
      } else {
        setCoverUri(result.uri);
      }
    } catch (err) {
      logger.error('Cover image manipulation failed', err);
      setCoverUri(uri);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Ouvre la caméra du device. Crop 3:1, qualité initiale 0.8.
   */
  const takePhoto = async () => {
    const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Camera permission denied by user');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      await processImage(asset.uri);
    } catch (err) {
      logger.error('launchCameraAsync (cover) failed', err);
    }
  };

  /**
   * Ouvre la galerie. Crop 3:1, qualité initiale 0.8.
   */
  const pickCover = async () => {
    const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Gallery permission denied by user');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      await processImage(asset.uri);
    } catch (err) {
      logger.error('launchImageLibraryAsync (cover) failed', err);
    }
  };

  /**
   * Upload le cover vers Supabase Storage (bucket "covers").
   * Retourne l'URL publique ou undefined si pas de cover / échec.
   */
  const uploadCover = async (userId: string): Promise<string | undefined> => {
    if (!coverUri) return undefined;

    try {
      const fileInfo = await FileSystem.getInfoAsync(coverUri);
      if (!fileInfo.exists) {
        logger.warn('Cover file not found at URI', { uri: coverUri });
        return undefined;
      }

      const ext = coverUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const contentType = validExt === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${userId}/cover.${validExt}`;

      const base64 = await FileSystem.readAsStringAsync(coverUri, {
        encoding: 'base64',
      });

      if (!base64) return undefined;

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage.from('covers').upload(filePath, bytes, {
        contentType,
        upsert: true,
      });

      if (uploadError) {
        logger.error('Cover upload failed', { message: uploadError.message });
        return undefined;
      }

      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      logger.error('Unexpected error in uploadCover', err);
      return undefined;
    }
  };

  return { coverUri, isProcessing, takePhoto, pickCover, uploadCover };
}
