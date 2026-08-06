// Écran de jeu — E10-04 (#295)
//
// WebView plein écran du jeu + header (retour, meilleur score, classement).
// À la fin d'une partie, le jeu envoie son score → on le soumet en DB et on
// rafraîchit le meilleur score. Bouton classement → sheet leaderboard.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, Sheet, Text, View, XStack, YStack } from 'tamagui';

import { GameWebView } from '@/features/games/components/GameWebView';
import { getGame } from '@/features/games/games/registry';
import {
  useGameLeaderboard,
  useMyBestGameScore,
  useSubmitGameScore,
} from '@/features/games/hooks/useGameScore';
import { useTranslations } from '@/i18n';

export default function GamePlayScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const gameId = typeof params.id === 'string' ? params.id : null;
  const game = gameId ? getGame(gameId) : undefined;

  const { data: best } = useMyBestGameScore(gameId);
  const submitScore = useSubmitGameScore();
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const leaderboard = useGameLeaderboard(isBoardOpen ? gameId : null);

  const handleScore = useCallback(
    (value: number) => {
      if (!gameId) return;
      submitScore.mutate({ gameId, score: value });
    },
    [gameId, submitScore]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  }, []);

  if (!game) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          <YStack flex={1} alignItems="center" justifyContent="center" gap={8}>
            <Text fontSize={16} fontWeight="700" color="$color">
              {t.games.play.notFoundTitle}
            </Text>
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t.games.play.back}
            >
              <Text color="$accentNeon" fontWeight="700">
                {t.games.play.notFoundBack}
              </Text>
            </Pressable>
          </YStack>
        </YStack>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="#000000" paddingTop={insets.top}>
        {/* Header */}
        <XStack
          height={52}
          paddingHorizontal={12}
          alignItems="center"
          gap={12}
          backgroundColor="$background"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.games.play.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <YStack flex={1}>
            <Text color="$color" fontSize={16} fontWeight="800" numberOfLines={1}>
              {game.title}
            </Text>
            {best != null ? (
              <Text color="$textSecondary" fontSize={11}>
                {t.games.play.bestScore(best)}
              </Text>
            ) : null}
          </YStack>
          <Pressable
            onPress={() => setIsBoardOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.games.play.leaderboardLabel}
          >
            <Trophy size={22} color="#FFFFFF" />
          </Pressable>
        </XStack>

        {/* Jeu */}
        <GameWebView html={game.html} onScore={handleScore} />
      </YStack>

      {/* Classement */}
      <Sheet
        modal
        open={isBoardOpen}
        onOpenChange={setIsBoardOpen}
        snapPoints={[75]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(0,0,0,0.55)"
        />
        <Sheet.Handle />
        <Sheet.Frame
          backgroundColor="$background"
          borderTopLeftRadius={20}
          borderTopRightRadius={20}
          paddingHorizontal={16}
          paddingTop={16}
          paddingBottom={insets.bottom + 16}
        >
          <XStack alignItems="center" gap={8} marginBottom={12}>
            <Trophy size={20} color="#FFFFFF" />
            <Text fontSize={18} fontWeight="800" color="$color">
              {t.games.play.leaderboardTitle(game.title)}
            </Text>
          </XStack>

          {leaderboard.isLoading ? (
            <YStack paddingVertical={30} alignItems="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : (leaderboard.data?.length ?? 0) === 0 ? (
            <Text fontSize={13} color="$textSecondary" paddingVertical={20} textAlign="center">
              {t.games.play.emptyLeaderboard}
            </Text>
          ) : (
            <YStack gap={4}>
              {leaderboard.data?.map((entry, i) => (
                <XStack
                  key={entry.user_id}
                  alignItems="center"
                  gap={10}
                  paddingVertical={8}
                  paddingHorizontal={10}
                  borderRadius={10}
                  backgroundColor={entry.is_me ? '#12291D' : 'transparent'}
                >
                  <Text
                    width={26}
                    fontSize={14}
                    fontWeight="800"
                    color={i < 3 ? '#FFFFFF' : '$textSecondary'}
                  >
                    {i + 1}
                  </Text>
                  <View
                    width={32}
                    height={32}
                    borderRadius={9999}
                    backgroundColor="$surfaceElevated"
                    overflow="hidden"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {entry.avatar_url ? (
                      <Image
                        source={{ uri: entry.avatar_url }}
                        style={styles.avatar}
                        objectFit="cover"
                      />
                    ) : (
                      <Text fontSize={13} fontWeight="700" color="$color">
                        {(entry.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text
                    flex={1}
                    fontSize={14}
                    fontWeight={entry.is_me ? '800' : '600'}
                    color="$color"
                    numberOfLines={1}
                  >
                    @{entry.username}
                    {entry.is_me ? t.games.play.meSuffix : ''}
                  </Text>
                  <Text fontSize={14} fontWeight="800" color="$accentNeon">
                    {entry.best_score}
                  </Text>
                </XStack>
              ))}
            </YStack>
          )}
        </Sheet.Frame>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: '100%',
    height: '100%',
  },
});
