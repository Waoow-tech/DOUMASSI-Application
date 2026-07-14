// ListingImageCarousel — E7-12
//
// Carousel horizontal des images d'une annonce. Si une seule image,
// affichage simple sans pagination. Si plusieurs, dots de pagination en bas.
//
// Implémentation FlatList pagingEnabled + suivi de l'index actif via
// onMomentumScrollEnd. Pas de lib externe pour rester léger.

import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import { XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface ListingImageCarouselProps {
  images: string[];
  /** Hauteur de l'image (la largeur prend toute la largeur écran). */
  height?: number;
  /** Label a11y de l'annonce, propagé aux images individuelles. */
  accessibilityLabelBase?: string;
}

export function ListingImageCarousel({
  images,
  height = 320,
  accessibilityLabelBase,
}: ListingImageCarouselProps) {
  const t = useTranslations();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const next = Math.round(offsetX / SCREEN_WIDTH);
      if (next !== activeIndex) setActiveIndex(next);
    },
    [activeIndex]
  );

  if (images.length === 0) {
    return (
      <YStack
        width={SCREEN_WIDTH}
        height={height}
        backgroundColor="$surface"
        accessibilityLabel={t.marketplace.carousel.noImage}
      />
    );
  }

  if (images.length === 1) {
    return (
      <Image
        source={{ uri: images[0] }}
        style={{ width: SCREEN_WIDTH, height }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={accessibilityLabelBase ?? t.marketplace.carousel.defaultImage}
      />
    );
  }

  return (
    <YStack>
      <FlatList
        data={images}
        keyExtractor={(item, i) => `${item}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <Image
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t.marketplace.carousel.imageCounter(
              accessibilityLabelBase ?? t.marketplace.carousel.image,
              index + 1,
              images.length
            )}
          />
        )}
      />
      {/* Dots */}
      <XStack
        position="absolute"
        bottom={12}
        left={0}
        right={0}
        justifyContent="center"
        alignItems="center"
        gap={6}
        pointerEvents="none"
      >
        {images.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : null]} />
        ))}
      </XStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
});
