// Hook for picking and uploading an avatar to Supabase Storage.
// Separated from useSignup to respect single responsibility.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.
// Extended for E2-09 — takePhoto (expo-camera) + processImage (expo-image-manipulator).

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function useAvatarPicker() {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Crop to 1:1, resize to max 800×800, compress < 200 Ko.
   * Falls back to original URI if manipulation fails.
   */
  const processImage = async (uri: string) => {
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800, height: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (fileInfo.exists && fileInfo.size > 200 * 1024) {
        const compressed = await ImageManipulator.manipulateAsync(result.uri, [], {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        setAvatarUri(compressed.uri);
      } else {
        setAvatarUri(result.uri);
      }
    } catch (err) {
      logger.error('Image manipulation failed', err);
      setAvatarUri(uri);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Open the device camera to take a photo.
   * Square crop 1:1, then process via ImageManipulator.
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
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      await processImage(asset.uri);
    } catch (err) {
      logger.error('launchCameraAsync failed', err);
    }
  };

  /**
   * Open the image picker (gallery) to choose an avatar.
   * Square crop 1:1, quality 0.8 to keep file size reasonable.
   */
  const pickAvatar = async () => {
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
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      await processImage(asset.uri);
    } catch (err) {
      logger.error('launchImageLibraryAsync failed', err);
    }
  };

  /**
   * Upload the avatar to Supabase Storage (bucket "avatars").
   * Returns the public URL or undefined if no avatar / upload failed.
   */
  const uploadAvatar = async (userId: string): Promise<string | undefined> => {
    if (!avatarUri) return undefined;

    try {
      const fileInfo = await FileSystem.getInfoAsync(avatarUri);
      if (!fileInfo.exists) {
        logger.warn('Avatar file not found at URI', { uri: avatarUri });
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
        logger.error('Avatar upload failed', { message: uploadError.message });
        return undefined;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      logger.error('Unexpected error in uploadAvatar', err);
      return undefined;
    }
  };

  return { avatarUri, isProcessing, takePhoto, pickAvatar, uploadAvatar };
}
