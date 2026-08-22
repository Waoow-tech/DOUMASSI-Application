// Cellule de la grille profil : image ou vidéo, overlay play pour les
// vidéos. La taille est imposée par le parent (calcul basé sur la largeur
// d'écran et le nombre de colonnes).

import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { YStack } from 'tamagui';

import type { PostGridItem } from '@/features/profile/hooks/useProfile';

interface ProfileGridItemProps {
  item: PostGridItem;
  size: number;
  isLastColumn: boolean;
  gap: number;
}

export function ProfileGridItem({ item, size, isLastColumn, gap }: ProfileGridItemProps) {
  // Pour les vidéos sans thumbnail, fallback sur video_url côté Image.
  const displayUrl = item.image_url ?? item.video_url;
  if (!displayUrl) return null;

  return (
    <YStack width={size} height={size} marginRight={isLastColumn ? 0 : gap} marginBottom={gap}>
      <Image
        source={{ uri: displayUrl }}
        style={styles.image}
        contentFit="cover"
        recyclingKey={item.id}
        transition={200}
      />
      {item.type === 'video' && (
        <YStack
          position="absolute"
          bottom={6}
          left={6}
          backgroundColor="rgba(0,0,0,0.4)"
          borderRadius={4}
          padding={2}
        >
          <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
        </YStack>
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
