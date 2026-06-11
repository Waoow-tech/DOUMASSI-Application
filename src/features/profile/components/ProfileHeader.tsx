// Header de profil partagé entre Mon profil (E3-01) et Profil autre (E3-03).
// Comprend : barre du haut (logo + kebab), cover, avatar superposé, nom,
// @username + badge vérifié, et bio. Les boutons d'action sont au-dessus
// (composés dans l'écran appelant via `actions`).

import { Image } from 'expo-image';
import { MoreVertical, User } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';

import { VerifiedBadge } from './VerifiedBadge';

const logoSource = require('../../../../assets/Logo-Doumassi.webp') as number;

const AVATAR_SIZE = 90;
const AVATAR_BORDER_WIDTH = 3;
const COVER_HEIGHT = 180;
const LOGO_HEIGHT = 28;

export interface ProfileHeaderData {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
}

interface ProfileHeaderProps {
  profile: ProfileHeaderData | null;
  onKebabPress: () => void;
  kebabAccessibilityLabel?: string;
}

export function ProfileHeader({
  profile,
  onKebabPress,
  kebabAccessibilityLabel = 'More options',
}: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <YStack>
      {/* Barre du haut : logo centré + kebab à droite */}
      <XStack
        position="absolute"
        top={insets.top + 8}
        left={0}
        right={0}
        zIndex={10}
        paddingHorizontal="$4"
        alignItems="center"
        justifyContent="center"
      >
        <YStack width={40} />
        <YStack flex={1} alignItems="center">
          <Image
            source={logoSource}
            style={styles.logoImage}
            contentFit="contain"
            transition={200}
          />
        </YStack>
        <TouchableOpacity
          onPress={onKebabPress}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.kebabButton}
          accessibilityLabel={kebabAccessibilityLabel}
        >
          <MoreVertical size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </XStack>

      {/* Cover image */}
      <YStack width="100%" height={COVER_HEIGHT + insets.top}>
        {profile?.cover_url ? (
          <Image
            source={{ uri: profile.cover_url }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <YStack flex={1} backgroundColor="$surface" />
        )}
      </YStack>

      {/* Avatar superposé */}
      <YStack alignItems="center" marginTop={-(AVATAR_SIZE / 2)}>
        <YStack
          width={AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2}
          height={AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2}
          borderRadius={9999}
          backgroundColor="#000000"
          alignItems="center"
          justifyContent="center"
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <YStack
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              borderRadius={9999}
              backgroundColor="$surface"
              alignItems="center"
              justifyContent="center"
            >
              <User size={40} color="#A0A0A0" />
            </YStack>
          )}
        </YStack>
      </YStack>

      {/* Nom (fallback @username) */}
      <Text
        fontSize={22}
        fontWeight="700"
        color="$color"
        textAlign="center"
        fontFamily="$heading"
        marginTop="$3"
      >
        {profile?.full_name ?? `@${profile?.username ?? ''}`}
      </Text>

      {/* @username + badge vérifié */}
      <XStack justifyContent="center" alignItems="center" gap={8} marginTop="$1">
        <Text fontSize={14} color="$textSecondary">
          @{profile?.username ?? ''}
        </Text>
        <VerifiedBadge isVerified={profile?.is_verified ?? false} />
      </XStack>

      {/* Bio (max 250 chars) */}
      {profile?.bio ? (
        <Text
          fontSize={14}
          color="$textSecondary"
          textAlign="center"
          marginTop="$2"
          paddingHorizontal="$5"
          lineHeight={20}
        >
          {profile.bio.length > 250 ? profile.bio.slice(0, 250) + '…' : profile.bio}
        </Text>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    width: 120,
    height: LOGO_HEIGHT,
  },
  kebabButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
});

// Exports utiles pour les écrans qui veulent calculer la hauteur du header
export const PROFILE_AVATAR_SIZE = AVATAR_SIZE;
export const PROFILE_AVATAR_BORDER_WIDTH = AVATAR_BORDER_WIDTH;
export const PROFILE_COVER_HEIGHT = COVER_HEIGHT;
