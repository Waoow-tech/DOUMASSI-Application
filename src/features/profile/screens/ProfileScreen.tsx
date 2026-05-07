// Écran "Mon profil" — E3-01.
// Header (cover + avatar overlap), nom, bio, compteurs, boutons, grille posts.
// Fidèle à la maquette Canva, dark mode exclusif.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { User } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, Share, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';

import { t } from '@/i18n';

import { useProfile, PostGridItem } from '../hooks/useProfile';

// --- Constantes layout ---
const AVATAR_SIZE = 90;
const AVATAR_BORDER_WIDTH = 3;
const COVER_HEIGHT = 180;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;

// --- Composant compteur ---
function StatCounter({ value, label }: { value: number; label: string }) {
  return (
    <YStack alignItems="center" flex={1}>
      <Text fontSize={20} fontWeight="700" color="$color" fontFamily="$heading">
        {value}
      </Text>
      <Text fontSize={12} color="$textSecondary" marginTop={2}>
        {label}
      </Text>
    </YStack>
  );
}

// --- Écran principal ---
export function ProfileScreen() {
  const { profile, counters, posts, isLoading, refetch } = useProfile();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const copy = t.profile;

  // Taille de chaque cellule de la grille (carré 1:1)
  const itemSize = (screenWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const handleEdit = useCallback(() => {
    router.push('/profile/edit');
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: copy.shareMessage });
    } catch {
      // L'utilisateur a annulé le partage — rien à faire.
    }
  }, [copy.shareMessage]);

  // --- Render item grille ---
  const renderGridItem = useCallback(
    ({ item, index }: { item: PostGridItem; index: number }) => {
      const isLastColumn = (index + 1) % NUM_COLUMNS === 0;
      return (
        <YStack
          width={itemSize}
          height={itemSize}
          marginRight={isLastColumn ? 0 : GRID_GAP}
          marginBottom={GRID_GAP}
        >
          <Image
            source={{ uri: item.image_url }}
            style={styles.gridImage}
            contentFit="cover"
            recyclingKey={item.id}
            transition={200}
          />
        </YStack>
      );
    },
    [itemSize]
  );

  const keyExtractor = useCallback((item: PostGridItem) => item.id, []);

  // --- Loading state ---
  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <Spinner size="large" color="$color" />
      </YStack>
    );
  }

  // --- Header (tout ce qui est au-dessus de la grille) ---
  const ListHeader = (
    <YStack>
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

      {/* Avatar — superposé à cheval entre la cover et le fond */}
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

      {/* Nom */}
      <Text
        fontSize={22}
        fontWeight="700"
        color="$color"
        textAlign="center"
        fontFamily="$heading"
        marginTop="$3"
      >
        {profile?.display_name ?? ''}
      </Text>

      {/* Bio */}
      {profile?.bio ? (
        <Text
          fontSize={14}
          color="$textSecondary"
          textAlign="center"
          marginTop="$1"
          paddingHorizontal="$5"
          lineHeight={20}
        >
          {profile.bio}
        </Text>
      ) : null}

      {/* Compteurs */}
      <XStack marginTop="$4" paddingHorizontal="$5" justifyContent="center" alignItems="center">
        <StatCounter value={counters.posts} label={copy.stats.posts} />
        <StatCounter value={counters.followers} label={copy.stats.followers} />
        <StatCounter value={counters.following} label={copy.stats.following} />
      </XStack>

      {/* Boutons d'action */}
      <XStack marginTop="$4" marginBottom="$4" paddingHorizontal="$5" gap="$3">
        <Button
          id="profile-edit-button"
          flex={1}
          height={40}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$borderColorHover"
          borderRadius="$lg"
          color="$color"
          fontWeight="600"
          fontSize={14}
          onPress={handleEdit}
          pressStyle={{ opacity: 0.7, scale: 0.98 }}
        >
          {copy.editButton}
        </Button>
        <Button
          id="profile-share-button"
          flex={1}
          height={40}
          backgroundColor="transparent"
          borderWidth={1}
          borderColor="$borderColorHover"
          borderRadius="$lg"
          color="$color"
          fontWeight="600"
          fontSize={14}
          onPress={() => void handleShare()}
          pressStyle={{ opacity: 0.7, scale: 0.98 }}
        >
          {copy.shareButton}
        </Button>
      </XStack>
    </YStack>
  );

  return (
    <FlatList<PostGridItem>
      data={posts}
      renderItem={renderGridItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      ListHeaderComponent={ListHeader}
      showsVerticalScrollIndicator={false}
      onRefresh={refetch}
      refreshing={false}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

// --- Styles statiques (pas de re-calc à chaque render) ---
const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#000000',
  },
  listContent: {
    paddingBottom: 32,
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
  gridImage: {
    width: '100%',
    height: '100%',
  },
});
