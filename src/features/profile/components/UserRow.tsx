// Composant UserRow — E3-05 / E3-06.
// Ligne d'un utilisateur dans les listes sociales
// (followers, following, recherche).
// Avatar, username, full_name, badge vérifié,
// slot d'action à droite + menu meatballs optionnel.

import { Image } from 'expo-image';
import { MoreHorizontal, User as UserIcon } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { VerifiedBadge } from './VerifiedBadge';

export interface UserRowData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

interface UserRowProps {
  user: UserRowData;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
  onMenuPress?: () => void;
}

const AVATAR_SIZE = 44;

export function UserRow({ user, rightSlot, onPress, onMenuPress }: UserRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <XStack
        paddingVertical="$3"
        paddingHorizontal="$4"
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack flex={1} alignItems="center" gap="$3">
          {/* Avatar */}
          <YStack
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={9999}
            backgroundColor="$surface"
            overflow="hidden"
            alignItems="center"
            justifyContent="center"
          >
            {user.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <UserIcon size={24} color="#A0A0A0" />
            )}
          </YStack>

          {/* Username + full_name */}
          <YStack flexShrink={1} gap={2}>
            <XStack alignItems="center" gap="$2">
              <Text
                fontSize={15}
                fontWeight="700"
                color="$color"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {user.username}
              </Text>
              <VerifiedBadge isVerified={user.is_verified} />
            </XStack>
            {user.full_name ? (
              <Text fontSize={13} color="$placeholderColor" numberOfLines={1} ellipsizeMode="tail">
                {user.full_name}
              </Text>
            ) : null}
          </YStack>
        </XStack>

        {/* Droite : bouton contextuel + meatballs */}
        <XStack alignItems="center" gap="$2">
          {rightSlot ?? null}
          {onMenuPress ? (
            <TouchableOpacity
              onPress={onMenuPress}
              hitSlop={{
                top: 8,
                bottom: 8,
                left: 8,
                right: 8,
              }}
            >
              <MoreHorizontal size={20} color="#A0A0A0" />
            </TouchableOpacity>
          ) : null}
        </XStack>
      </XStack>
    </TouchableOpacity>
  );
}
