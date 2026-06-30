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
        'Caméra non autorisée',
        'Active la caméra dans les réglages pour prendre une photo.'
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
  }, [images, onChange]);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    Alert.alert(
      'Ajouter une photo',
      `Tu peux ajouter encore ${maxImages - images.length} photo${maxImages - images.length > 1 ? 's' : ''}.`,
      [
        { text: 'Galerie', onPress: () => void pickFromGallery() },
        { text: 'Caméra', onPress: () => void pickFromCamera() },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }, [canAdd, images.length, maxImages, pickFromCamera, pickFromGallery]);

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
              accessibilityLabel={`Supprimer la photo ${i + 1}`}
              style={styles.removeBadge}
            >
              <X size={12} color="#FFFFFF" strokeWidth={3} />
            </Pressable>
            {i === 0 ? (
              <View style={styles.coverBadge}>
                <Text fontSize={9} fontWeight="700" color="#000000">
                  COUVERTURE
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
                ? 'Ajouter une photo'
                : `Ajouter une photo (${images.length}/${maxImages})`
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
        La 1ère photo sera utilisée comme couverture. Glisse pour réorganiser bientôt.
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
