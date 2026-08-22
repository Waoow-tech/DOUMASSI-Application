// Écran catalogue Jeux — E10-03 (#294)
//
// Grille des mini-jeux curatés. Chaque carte affiche l'icône, le titre et le
// meilleur score perso. Tap → écran de jeu.

import { router, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { GAMES, type GameDef } from '@/features/games/games/registry';
import { useMyBestGameScore } from '@/features/games/hooks/useGameScore';
import { useTranslations } from '@/i18n';

const GUTTER = 12;
const GAP = 12;
const NUM_COLUMNS = 2;

function GameCard({ game, width }: { game: GameDef; width: number }) {
  const t = useTranslations();
  const { data: best } = useMyBestGameScore(game.id);
  const { Icon } = game;
  return (
    <Pressable
      onPress={() => router.push(`/games/${game.id}`)}
      accessibilityRole="button"
      accessibilityLabel={t.games.catalog.playLabel(game.title)}
      style={{ width }}
    >
      <YStack backgroundColor="$surface" borderRadius={16} overflow="hidden">
        <YStack
          height={width * 0.7}
          backgroundColor={game.bgColor}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={44} color={game.accentColor} strokeWidth={1.7} />
        </YStack>
        <YStack padding={12} gap={2}>
          <Text fontSize={15} fontWeight="800" color="$color" numberOfLines={1}>
            {game.title}
          </Text>
          <Text fontSize={11} color="$textSecondary" numberOfLines={2}>
            {game.description}
          </Text>
          <Text fontSize={11} color="$accentNeon" fontWeight="700" marginTop={4}>
            {best != null ? t.games.catalog.bestScore(best) : t.games.catalog.neverPlayed}
          </Text>
        </YStack>
      </YStack>
    </Pressable>
  );
}

export default function GamesCatalogScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GUTTER * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <XStack
          height={56}
          paddingHorizontal={12}
          alignItems="center"
          gap={12}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.games.catalog.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            {t.games.catalog.title}
          </Text>
        </XStack>

        <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: insets.bottom + 24 }}>
          <View flexDirection="row" flexWrap="wrap" gap={GAP}>
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} width={cardWidth} />
            ))}
          </View>
        </ScrollView>
      </YStack>
    </>
  );
}
