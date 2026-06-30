// SellerCard — E7-12 — Carte vendeur cliquable dans la fiche produit.
//
// Affiche avatar + username + badge vérifié. Tap → router.push profil
// du vendeur (réutilise la route existante /profile/[id]).

import { Image } from 'expo-image';
import { ChevronRight, User as UserIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { VerifiedBadge } from '@/features/profile/components/VerifiedBadge';

export interface SellerCardProps {
  seller: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
  onPress: () => void;
}

export function SellerCard({ seller, onPress }: SellerCardProps) {
  const initial = (seller.username || '?').charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Voir le profil de ${seller.username}`}
      accessibilityHint="Tap pour ouvrir le profil du vendeur"
      style={styles.container}
    >
      <XStack
        backgroundColor="$surface"
        borderRadius={12}
        padding={12}
        alignItems="center"
        gap={12}
      >
        <YStack
          width={48}
          height={48}
          borderRadius={9999}
          backgroundColor="$surfaceElevated"
          overflow="hidden"
          alignItems="center"
          justifyContent="center"
        >
          {seller.avatar_url ? (
            <Image
              source={{ uri: seller.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <Text fontSize={18} fontWeight="700" color="$color">
              {initial}
            </Text>
          )}
        </YStack>

        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap={4}>
            <Text
              fontSize={15}
              fontWeight="700"
              color="$color"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              @{seller.username}
            </Text>
            <VerifiedBadge isVerified={seller.is_verified} />
          </XStack>
          {seller.full_name ? (
            <Text fontSize={12} color="$textSecondary" numberOfLines={1}>
              {seller.full_name}
            </Text>
          ) : null}
        </YStack>

        <UserIcon size={16} color="#A0A0A0" />
        <ChevronRight size={16} color="#A0A0A0" />
      </XStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: '100%',
    height: '100%',
  },
  container: {
    width: '100%',
  },
});
