// Écran "Mon profil" — E3-01 (v2).
// Header (logo + cover + avatar overlap), nom, @username, badge vérifié,
// kebab menu (Tamagui Sheet), compteurs cliquables, onglets (grille/reels/tagged),
// FlashList pour la grille de posts, empty state.
// Fidèle à la maquette Canva, dark mode exclusif.

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Camera,
  Grid3x3,
  MoreVertical,
  Play,
  Settings,
  Share2,
  User,
  UserSquare2,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Share,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { t } from '@/i18n';

import { useProfile, PostGridItem } from '../hooks/useProfile';

const logoSource = require('../../../../assets/Logo-Doumassi.png') as number;

// --- Constantes layout ---
const AVATAR_SIZE = 90;
const AVATAR_BORDER_WIDTH = 3;
const COVER_HEIGHT = 180;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const LOGO_HEIGHT = 28;

// --- Types onglets ---
type ProfileTab = 'grid' | 'reels' | 'tagged';

// --- Composant Logo DOUMASSI (image asset) ---
function DoumassiLogo() {
  return (
    <Image source={logoSource} style={styles.logoImage} contentFit="contain" transition={200} />
  );
}

// --- Badge Vérifié (conditionnel sur is_verified) ---
function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  if (!isVerified) return null;
  const copy = t.profile;
  return (
    <XStack
      backgroundColor="#3B82F6"
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius={12}
      alignItems="center"
      gap={4}
    >
      <Text fontSize={11} fontWeight="700" color="#FFFFFF">
        ✓ {copy.verifiedBadge}
      </Text>
    </XStack>
  );
}

// --- Skeleton shimmer pour le loading ---
function SkeletonBlock({
  width,
  height,
  borderRadius = 4,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#2A2A2A',
          opacity,
        },
        style,
      ]}
    />
  );
}

// --- Composant compteur (rendu cliquable depuis le parent) ---
function StatCounter({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <YStack alignItems="center" flex={1}>
      <Text fontSize={20} fontWeight="700" color="$color" fontFamily="$heading">
        {value}
      </Text>
      <Text fontSize={12} color="$textSecondary" marginTop={2}>
        {label}
      </Text>
    </YStack>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.statTouchable}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// --- Onglet du Segmented Control ---
function TabButton({
  icon,
  isActive,
  onPress,
}: {
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
    >
      {icon}
    </TouchableOpacity>
  );
}

// --- Empty State ---
function EmptyState() {
  const copy = t.profile;
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical={80} gap="$3">
      <YStack
        width={72}
        height={72}
        borderRadius={36}
        borderWidth={2}
        borderColor="$borderColorHover"
        alignItems="center"
        justifyContent="center"
      >
        <Camera size={32} color="#A0A0A0" />
      </YStack>
      <Text fontSize={15} color="$textSecondary" textAlign="center" fontWeight="500">
        {copy.emptyState.title}
      </Text>
    </YStack>
  );
}

// --- Écran principal ---
export function ProfileScreen() {
  const { profile, userId, counters, posts, isLoading, refetch } = useProfile();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const copy = t.profile;

  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  // --- Menu Kebab : ouvre la Sheet ---
  const handleKebabMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  // --- Actions de la Sheet ---
  const handleMenuSettings = useCallback(() => {
    setIsMenuOpen(false);
    router.push('/settings');
  }, []);

  const handleMenuShare = useCallback(() => {
    setIsMenuOpen(false);
    void handleShare();
  }, [handleShare]);

  // --- Navigation compteurs ---
  const handleFollowers = useCallback(() => {
    if (userId) {
      router.push(`/profile/${userId}/followers`);
    }
  }, [userId]);

  const handleFollowing = useCallback(() => {
    router.push('/following');
  }, []);

  // --- Render item grille ---
  const renderGridItem = useCallback(
    ({ item, index }: { item: PostGridItem; index: number }) => {
      const isLastColumn = (index + 1) % NUM_COLUMNS === 0;
      // Pour les vidéos sans thumbnail, on utilise video_url comme source image
      const displayUrl = item.image_url ?? item.video_url;
      if (!displayUrl) return null;
      return (
        <YStack
          width={itemSize}
          height={itemSize}
          marginRight={isLastColumn ? 0 : GRID_GAP}
          marginBottom={GRID_GAP}
        >
          <Image
            source={{ uri: displayUrl }}
            style={styles.gridImage}
            contentFit="cover"
            recyclingKey={item.id}
            transition={200}
          />
          {/* Overlay play pour les posts vidéo */}
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
          {/* TODO: View count overlay — à câbler quand le système de vues est en place.
           * Utiliser formatViewCount() de @/utils/formatCount.ts
           * Position: absolute, bottom-right, avec icône Eye + texte formaté.
           */}
        </YStack>
      );
    },
    [itemSize]
  );

  const keyExtractor = useCallback((item: PostGridItem) => item.id, []);

  // --- Skeleton loading state ---
  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background">
        {/* Cover skeleton */}
        <SkeletonBlock width="100%" height={COVER_HEIGHT + insets.top} borderRadius={0} />
        {/* Avatar skeleton */}
        <YStack alignItems="center" marginTop={-(AVATAR_SIZE / 2)}>
          <SkeletonBlock
            width={AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2}
            height={AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2}
            borderRadius={9999}
          />
        </YStack>
        {/* Name skeleton */}
        <YStack alignItems="center" marginTop={16} gap={8}>
          <SkeletonBlock width={140} height={20} borderRadius={6} />
          <SkeletonBlock width={100} height={14} borderRadius={6} />
        </YStack>
        {/* Bio skeleton */}
        <YStack alignItems="center" marginTop={12} gap={6}>
          <SkeletonBlock width={260} height={12} borderRadius={4} />
          <SkeletonBlock width={200} height={12} borderRadius={4} />
        </YStack>
        {/* Counters skeleton */}
        <XStack marginTop={20} paddingHorizontal={40} justifyContent="space-between">
          <SkeletonBlock width={60} height={36} borderRadius={6} />
          <SkeletonBlock width={60} height={36} borderRadius={6} />
          <SkeletonBlock width={60} height={36} borderRadius={6} />
        </XStack>
      </YStack>
    );
  }

  // Données pour la grille selon l'onglet actif
  // Seul l'onglet "grid" affiche du contenu pour l'instant.
  const gridData = activeTab === 'grid' ? posts : [];

  // --- Header (tout ce qui est au-dessus de la grille) ---
  const ListHeader = (
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
        {/* Spacer gauche pour centrer le logo */}
        <YStack width={40} />

        {/* Logo DOUMASSI centré */}
        <YStack flex={1} alignItems="center">
          <DoumassiLogo />
        </YStack>

        {/* Menu kebab à droite */}
        <TouchableOpacity
          id="profile-kebab-menu"
          onPress={handleKebabMenu}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.kebabButton}
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

      {/* Nom — fallback : display_name → full_name → @username */}
      <Text
        fontSize={22}
        fontWeight="700"
        color="$color"
        textAlign="center"
        fontFamily="$heading"
        marginTop="$3"
      >
        {profile?.display_name ?? profile?.full_name ?? `@${profile?.username ?? ''}`}
      </Text>

      {/* @username + badge vérifié (conditionnel) */}
      <XStack justifyContent="center" alignItems="center" gap={8} marginTop="$1">
        <Text fontSize={14} color="$textSecondary">
          @{profile?.username ?? ''}
        </Text>
        <VerifiedBadge isVerified={profile?.is_verified ?? false} />
      </XStack>

      {/* Bio */}
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

      {/* Compteurs — followers et suivis cliquables */}
      <XStack marginTop="$4" paddingHorizontal="$5" justifyContent="center" alignItems="center">
        <StatCounter value={counters.posts} label={copy.stats.posts} />
        <StatCounter
          value={counters.followers}
          label={copy.stats.followers}
          onPress={handleFollowers}
        />
        <StatCounter
          value={counters.following}
          label={copy.stats.following}
          onPress={handleFollowing}
        />
      </XStack>

      {/* Boutons d'action */}
      <XStack marginTop="$4" paddingHorizontal="$5" gap="$3">
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

      {/* Onglets de filtrage — Segmented Control */}
      <XStack
        marginTop="$4"
        borderTopWidth={0.5}
        borderBottomWidth={0.5}
        borderColor="$borderColor"
      >
        <TabButton
          icon={<Grid3x3 size={22} color={activeTab === 'grid' ? '#FFFFFF' : '#A0A0A0'} />}
          isActive={activeTab === 'grid'}
          onPress={() => setActiveTab('grid')}
        />
        <TabButton
          icon={<Play size={22} color={activeTab === 'reels' ? '#FFFFFF' : '#A0A0A0'} />}
          isActive={activeTab === 'reels'}
          onPress={() => setActiveTab('reels')}
        />
        <TabButton
          icon={<UserSquare2 size={22} color={activeTab === 'tagged' ? '#FFFFFF' : '#A0A0A0'} />}
          isActive={activeTab === 'tagged'}
          onPress={() => setActiveTab('tagged')}
        />
      </XStack>
    </YStack>
  );

  return (
    <>
      <FlashList<PostGridItem>
        data={gridData}
        renderItem={renderGridItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Bottom Sheet — Menu kebab cross-platform (Tamagui Sheet) */}
      <Sheet
        modal
        open={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        snapPoints={[25]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(0,0,0,0.5)"
        />
        <Sheet.Frame
          backgroundColor="$surface"
          borderTopLeftRadius={16}
          borderTopRightRadius={16}
          paddingHorizontal="$4"
          paddingTop="$3"
          paddingBottom="$5"
        >
          {/* Poignée */}
          <XStack justifyContent="center" marginBottom="$3">
            <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColorHover" />
          </XStack>

          <YStack gap="$1">
            {/* Paramètres */}
            <Button
              id="menu-settings-button"
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleMenuSettings}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Settings size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                {copy.kebabMenu.settings}
              </Text>
            </Button>

            {/* Partager mon profil */}
            <Button
              id="menu-share-button"
              backgroundColor="transparent"
              height={48}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              onPress={handleMenuShare}
              pressStyle={{ backgroundColor: '$surfaceElevated' }}
              borderRadius="$md"
              icon={<Share2 size={20} color="#FFFFFF" />}
            >
              <Text color="$color" fontSize={15} fontWeight="500">
                {copy.kebabMenu.shareProfile}
              </Text>
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}

// --- Styles statiques (pas de re-calc à chaque render) ---
const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#000000',
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
  statTouchable: {
    flex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#FFFFFF',
  },
});
