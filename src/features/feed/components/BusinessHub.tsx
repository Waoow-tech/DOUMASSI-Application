// BusinessHub — E7-17 (#254)
//
// Affiché quand l'utilisateur sélectionne l'onglet "Business" de la TopTabs
// du Feed. Grille de 6 cards catégories. Seule MARKETPLACE est cliquable
// (router.push '/shop'). Les 5 autres sont grisées avec overlay "Bientôt
// disponible".
//
// Layout fidèle à la maquette CEO (mix small/wide cards) :
//   Row 1 : MARKETPLACE (gauche) + FILMS (droite)     — 2 cards 50%/50%
//   Row 2 : IMMOBILIER                                 — 1 card 100%
//   Row 3 : JEUX                                       — 1 card 100%
//   Row 4 : MUSIQUE (gauche) + COURS (droite)         — 2 cards 50%/50%
//
// MVP : placeholders couleur + icône Lucide centrée. Les vraies images
// viendront via assets/ ultérieurement, sans refactor du composant (la
// prop `image` accepte déjà un require()).

import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  BookOpen,
  Film,
  Gamepad2,
  Home,
  Music,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

type CategoryId = 'marketplace' | 'films' | 'immobilier' | 'jeux' | 'musique' | 'cours';

// Images de fond par catégorie (webp optimisées ~20-60 Ko). Mapping SÉPARÉ du
// tableau CATEGORIES pour ne pas entrer en conflit avec les PRs qui modifient
// les `href` (ex. activation de la tuile Jeux).
const CATEGORY_IMAGES: Record<CategoryId, number> = {
  marketplace: require('../../../../assets/business-hub/marketplace.webp') as number,
  films: require('../../../../assets/business-hub/films.webp') as number,
  immobilier: require('../../../../assets/business-hub/immobilier.webp') as number,
  jeux: require('../../../../assets/business-hub/jeux.webp') as number,
  musique: require('../../../../assets/business-hub/musique.webp') as number,
  cours: require('../../../../assets/business-hub/cours.webp') as number,
};

interface CategoryDef {
  id: CategoryId;
  Icon: LucideIcon;
  /** Couleur de fond placeholder (sera remplacée par une image plus tard). */
  bgColor: string;
  /** Couleur d'accent pour le voile gradient. */
  accentColor: string;
  /** Pousser vers cette route au tap. null = card désactivée. */
  href: string | null;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'marketplace',
    Icon: ShoppingBag,
    bgColor: '#1F1F1F',
    accentColor: '#FFFFFF',
    href: '/shop',
  },
  {
    id: 'films',
    Icon: Film,
    bgColor: '#2D1F3D',
    accentColor: '#8B5CF6',
    href: null,
  },
  {
    id: 'immobilier',
    Icon: Home,
    bgColor: '#3D2F1F',
    accentColor: '#F59E0B',
    href: null,
  },
  {
    id: 'jeux',
    Icon: Gamepad2,
    bgColor: '#1F2D3D',
    accentColor: '#3B82F6',
    // E10-03 — verticale Jeux active (mini-jeux HTML5 + scores).
    href: '/games',
  },
  {
    id: 'musique',
    Icon: Music,
    bgColor: '#3D1F2D',
    accentColor: '#EC4899',
    href: null,
  },
  {
    id: 'cours',
    Icon: BookOpen,
    bgColor: '#1F3D2F',
    accentColor: '#10B981',
    // E9-09 — verticale Cours ("Apprendre") active. La tuile garde le libellé
    // "COURS" (fidélité maquette CEO), l'écran s'intitule "Apprendre".
    href: '/cours',
  },
];

interface CategoryCardProps {
  category: CategoryDef;
  variant: 'small' | 'wide';
}

function CategoryCard({ category, variant }: CategoryCardProps) {
  const t = useTranslations();
  const isActive = category.href != null;
  const { Icon } = category;
  const image = CATEGORY_IMAGES[category.id];
  const label = t.feed.businessHub.categories[category.id];

  const handlePress = () => {
    if (!isActive || !category.href) return;
    router.push(category.href);
  };

  // Hauteurs : small = ~46% width (ratio carré), wide = ~30% width (ratio 2:1).
  // On laisse Tamagui calculer via aspectRatio.
  const aspectRatio = variant === 'small' ? 1 : 2.1;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isActive}
      accessibilityRole="button"
      accessibilityLabel={
        isActive
          ? t.feed.businessHub.openCategoryA11y(label)
          : t.feed.businessHub.comingSoonA11y(label)
      }
      accessibilityState={{ disabled: !isActive }}
      style={[styles.cardPressable, variant === 'small' ? styles.cardSmall : styles.cardWide]}
    >
      <YStack
        width="100%"
        aspectRatio={aspectRatio}
        backgroundColor={category.bgColor}
        borderRadius={14}
        overflow="hidden"
        position="relative"
        opacity={isActive ? 1 : 0.55}
      >
        {/* Image de fond (ou icône en fallback si absente) */}
        {image ? (
          <Image source={image} style={styles.bgImage} contentFit="cover" transition={200} />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icon
              size={variant === 'wide' ? 64 : 56}
              color={category.accentColor}
              strokeWidth={1.6}
            />
          </YStack>
        )}

        {/* Voile sombre pour la lisibilité des overlays */}
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          height="55%"
          backgroundColor="rgba(0,0,0,0.28)"
          pointerEvents="none"
        />

        {/* Titre overlay top-left */}
        <View
          position="absolute"
          top={12}
          left={12}
          backgroundColor="rgba(0,0,0,0.55)"
          paddingHorizontal={8}
          paddingVertical={3}
          borderRadius={4}
        >
          <Text fontSize={13} fontWeight="800" color="#FFFFFF" letterSpacing={0.5}>
            {label}
          </Text>
        </View>

        {/* CTA bas-gauche — "Voir plus" actif, "Bientôt" inactif */}
        <View
          position="absolute"
          bottom={12}
          left={12}
          backgroundColor={isActive ? '#FFFFFF' : 'rgba(0,0,0,0.7)'}
          paddingHorizontal={12}
          paddingVertical={6}
          borderRadius={9999}
          pointerEvents="none"
        >
          <Text fontSize={11} fontWeight="700" color={isActive ? '#000000' : '#FFFFFF'}>
            {isActive ? t.feed.businessHub.seeMore : t.feed.businessHub.comingSoon}
          </Text>
        </View>
      </YStack>
    </Pressable>
  );
}

export function BusinessHub() {
  // Helpers pour récupérer une cat par id (le code reste lisible si on
  // ré-ordonne la liste plus tard).
  const get = (id: CategoryId) => {
    const c = CATEGORIES.find((cat) => cat.id === id);
    if (!c) throw new Error(`Category ${id} introuvable`);
    return c;
  };

  return (
    <YStack gap={10} paddingHorizontal={12} paddingTop={6} paddingBottom={20}>
      {/* Row 1 : Marketplace + Films */}
      <XStack gap={10}>
        <CategoryCard category={get('marketplace')} variant="small" />
        <CategoryCard category={get('films')} variant="small" />
      </XStack>

      {/* Row 2 : Immobilier (wide) */}
      <CategoryCard category={get('immobilier')} variant="wide" />

      {/* Row 3 : Jeux (wide) */}
      <CategoryCard category={get('jeux')} variant="wide" />

      {/* Row 4 : Musique + Cours */}
      <XStack gap={10}>
        <CategoryCard category={get('musique')} variant="small" />
        <CategoryCard category={get('cours')} variant="small" />
      </XStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    width: '100%',
    height: '100%',
  },
  cardPressable: {
    borderRadius: 14,
  },
  cardSmall: {
    flex: 1,
  },
  cardWide: {
    width: '100%',
  },
});
