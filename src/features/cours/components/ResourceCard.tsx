// ResourceCard — E9-04 — Carte d'une ressource dans la liste "Apprendre"
//
// Contrairement au ListingCard marketplace (grille 2 col orientée image),
// une ressource est du contenu texte/document → on privilégie une carte
// pleine largeur, plus lisible : vignette type à gauche, titre + méta +
// auteur à droite, bookmark en haut à droite.

import { Image } from 'expo-image';
import {
  Bookmark,
  BookOpen,
  Eye,
  FileText,
  PenLine,
  ScrollText,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import { type ResourceListItem, type ResourceType } from '../hooks/useResources';

const HIT_SLOP = { top: 10, right: 10, bottom: 10, left: 10 };

// Icône + couleur d'accent par type de ressource.
const TYPE_VISUAL: Record<ResourceType, { Icon: LucideIcon; color: string; bg: string }> = {
  cours: { Icon: BookOpen, color: '#10D970', bg: '#12291D' },
  fiche_revision: { Icon: FileText, color: '#3B82F6', bg: '#12203A' },
  exercices: { Icon: PenLine, color: '#F59E0B', bg: '#2E2410' },
  annale: { Icon: ScrollText, color: '#EC4899', bg: '#2E1522' },
};

export interface ResourceCardProps {
  resource: ResourceListItem;
  /** Libellé du niveau (résolu depuis la taxonomie par l'écran parent). */
  levelLabel: string;
  /** Libellé de la matière. */
  subjectLabel: string;
  onPress: () => void;
  onToggleBookmark: () => void;
  isBookmarkPending?: boolean;
}

function ResourceCardComponent({
  resource,
  levelLabel,
  subjectLabel,
  onPress,
  onToggleBookmark,
  isBookmarkPending = false,
}: ResourceCardProps) {
  const t = useTranslations();
  const visual = TYPE_VISUAL[resource.type];
  const { Icon } = visual;
  // Si le 1er fichier est une image, on l'affiche en vignette, sinon icône type.
  const firstImage = resource.files.find((f) => /\.(jpe?g|png|webp)$/i.test(f)) ?? null;

  const a11yLabel = t.cours.card.a11yLabel(
    t.cours.resourceType[resource.type],
    resource.title,
    subjectLabel,
    levelLabel,
    resource.author_username
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={styles.card}
    >
      <XStack
        backgroundColor="$surface"
        borderRadius={14}
        padding={12}
        gap={12}
        alignItems="center"
      >
        {/* Vignette type / image */}
        <View
          width={56}
          height={56}
          borderRadius={10}
          overflow="hidden"
          backgroundColor={visual.bg}
          alignItems="center"
          justifyContent="center"
        >
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.thumb} contentFit="cover" />
          ) : (
            <Icon size={26} color={visual.color} strokeWidth={1.9} />
          )}
        </View>

        {/* Contenu */}
        <YStack flex={1} minWidth={0} gap={4}>
          {/* Badge type + niveau·matière */}
          <XStack alignItems="center" gap={6} flexWrap="wrap">
            <View
              backgroundColor={visual.bg}
              paddingHorizontal={7}
              paddingVertical={2}
              borderRadius={4}
            >
              <Text fontSize={10} fontWeight="700" color={visual.color}>
                {t.cours.resourceType[resource.type]}
              </Text>
            </View>
            <Text fontSize={11} color="$textSecondary" numberOfLines={1}>
              {subjectLabel} · {levelLabel}
            </Text>
          </XStack>

          {/* Titre */}
          <Text fontSize={15} fontWeight="700" color="$color" numberOfLines={2}>
            {resource.title}
          </Text>

          {/* Auteur + vues */}
          <XStack alignItems="center" gap={8}>
            <Text fontSize={11} color="$textSecondary" numberOfLines={1}>
              @{resource.author_username}
            </Text>
            <XStack alignItems="center" gap={3}>
              <Eye size={11} color="#A0A0A0" />
              <Text fontSize={11} color="$textSecondary">
                {resource.view_count}
              </Text>
            </XStack>
          </XStack>
        </YStack>

        {/* Bookmark */}
        <Pressable
          onPress={onToggleBookmark}
          disabled={isBookmarkPending}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            resource.bookmarked_by_me ? t.cours.bookmark.remove : t.cours.bookmark.add
          }
          accessibilityState={{ selected: resource.bookmarked_by_me }}
          style={styles.bookmarkButton}
        >
          <Bookmark
            size={20}
            color={resource.bookmarked_by_me ? '#10D970' : '#A0A0A0'}
            fill={resource.bookmarked_by_me ? '#10D970' : 'transparent'}
            strokeWidth={2.1}
          />
        </Pressable>
      </XStack>
    </Pressable>
  );
}

export const ResourceCard = memo(ResourceCardComponent);

const styles = StyleSheet.create({
  bookmarkButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});
