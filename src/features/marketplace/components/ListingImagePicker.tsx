// ListingImagePicker — E7-14 (#245)
//
// Grid des images sélectionnées + bouton "Ajouter une photo". Limite à
// MAX_IMAGES (4) — au-delà, le bouton disparaît.
//
// L'upload réel se fait au moment du submit du formulaire (cf
// app/shop/create.tsx) pour ne pas uploader des images qu'on jettera si
// l'user annule.

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

export interface ListingImagePickerProps {
  /** URIs locales (avant upload) ou URLs distantes (édition future). */
  images: string[];
  onChange: (next: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

const DEFAULT_MAX = 4;
const TILE_SIZE = 80;

export function ListingImagePicker({
  images,
  onChange,
  maxImages = DEFAULT_MAX,
  disabled = false,
}: ListingImagePickerProps) {
  const t = useTranslations();
  const canAdd = images.length < maxImages && !disabled;

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, maxImages - images.length),
      quality: 1,
    });
    if (result.canceled) return;
    const picked = result.assets.map((a) => a.uri).slice(0, maxImages - images.length);
    onChange([...images, ...picked]);
  }, [images, maxImages, onChange]);

  const pickFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t.marketplace.imagePicker.cameraDeniedTitle,
        t.marketplace.imagePicker.cameraDeniedMessage
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) onChange([...images, uri]);
  }, [images, onChange, t]);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    Alert.alert(
      t.marketplace.imagePicker.addPhoto,
      t.marketplace.imagePicker.addMessage(maxImages - images.length),
      [
        { text: t.marketplace.imagePicker.gallery, onPress: () => void pickFromGallery() },
        { text: t.marketplace.imagePicker.camera, onPress: () => void pickFromCamera() },
        { text: t.marketplace.common.cancel, style: 'cancel' },
      ]
    );
  }, [canAdd, images.length, maxImages, pickFromCamera, pickFromGallery, t]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange]
  );

  return (
    <YStack gap={8}>
      <XStack gap={8} flexWrap="wrap">
        {images.map((uri, i) => (
          <View key={`${uri}-${i}`} style={styles.tile}>
            <Image source={{ uri }} style={styles.tileImage} contentFit="cover" />
            <Pressable
              onPress={() => handleRemove(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t.marketplace.imagePicker.removeA11y(i + 1)}
              style={styles.removeBadge}
            >
              <X size={12} color="#FFFFFF" strokeWidth={3} />
            </Pressable>
            {i === 0 ? (
              <View style={styles.coverBadge}>
                <Text fontSize={9} fontWeight="700" color="#000000">
                  {t.marketplace.imagePicker.cover}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        {canAdd ? (
          <Pressable
            onPress={handleAdd}
            accessibilityRole="button"
            accessibilityLabel={
              images.length === 0
                ? t.marketplace.imagePicker.addPhoto
                : t.marketplace.imagePicker.addPhotoCount(images.length, maxImages)
            }
            style={styles.addTile}
          >
            {images.length === 0 ? (
              <Camera size={26} color="#FFFFFF" strokeWidth={1.8} />
            ) : (
              <ImagePlus size={22} color="#FFFFFF" strokeWidth={1.8} />
            )}
            <Text fontSize={10} color="#A0A0A0" marginTop={4}>
              {images.length}/{maxImages}
            </Text>
          </Pressable>
        ) : null}
      </XStack>
      <Text fontSize={11} color="$textSecondary">
        {t.marketplace.imagePicker.coverHint}
      </Text>
    </YStack>
  );
}

const styles = StyleSheet.create({
  addTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10D970',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});
