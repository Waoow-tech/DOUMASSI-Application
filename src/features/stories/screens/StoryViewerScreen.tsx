// StoryViewerScreen — E4-13.
// Visionneuse plein écran type Instagram. Démarre sur l'user `userId`
// passé en route param, à sa 1re story non-vue (ou 1re tout court si
// tout a été vu).
//
// Choix d'archi MVP :
//  - Tap zones gauche (1/3) / milieu (1/3 pause/play) / droite (2/3).
//  - Auto-advance par progress bar (Animated.Value, JS thread — assez
//    pour des barres de 5-15s).
//  - Pas de swipe horizontal entre users pour le MVP — quand on finit
//    les stories d'un user, on enchaîne sur le suivant automatiquement.
//    Pour quitter avant : X en haut à droite.
//  - mark_seen idempotent au mount de chaque story (via useRef pour
//    éviter les double-appels).

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Eye, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack } from 'tamagui';

import { StoryViewersSheet } from '@/features/stories/components/StoryViewersSheet';
import {
  type StoryItem,
  type StoryUserGroup,
  useMarkStoryViewed,
  useStoriesFeed,
} from '@/features/stories/hooks/useStoriesFeed';

const PHOTO_DURATION_MS = 5000;
const MIN_VIDEO_DURATION_MS = 5000;

function durationOf(story: StoryItem): number {
  if (story.media_type === 'video' && story.duration_seconds) {
    return Math.max(MIN_VIDEO_DURATION_MS, story.duration_seconds * 1000);
  }
  return PHOTO_DURATION_MS;
}

function formatRelativeTime(value: string): string {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return '';
  const elapsedMs = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function ProgressBars({
  count,
  currentIndex,
  progress,
}: {
  count: number;
  currentIndex: number;
  progress: Animated.Value;
}) {
  return (
    <XStack gap={4} paddingHorizontal={12} marginTop={8}>
      {Array.from({ length: count }, (_, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <View key={i} style={styles.progressTrack}>
            {isPast ? (
              <View style={[styles.progressFill, { width: '100%' }]} />
            ) : isCurrent ? (
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </XStack>
  );
}

function StoryBackground({ story, isPaused }: { story: StoryItem; isPaused: boolean }) {
  const isVideo = story.media_type === 'video';
  const player = useVideoPlayer(isVideo ? story.media_url : '', (instance) => {
    if (!isVideo) return;
    instance.loop = false;
    instance.muted = false;
    instance.play();
  });

  useEffect(() => {
    if (!isVideo || !player) return;
    if (isPaused) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPaused, isVideo, player]);

  if (isVideo) {
    return (
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    );
  }
  return (
    <Image
      source={{ uri: story.media_url }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      recyclingKey={story.id}
      transition={150}
    />
  );
}

function ErrorState() {
  return (
    <YStack flex={1} backgroundColor="#000000" alignItems="center" justifyContent="center" gap={16}>
      <StatusBar hidden />
      <Text color="#FFFFFF" fontSize={18} fontWeight="700">
        Aucune story à afficher
      </Text>
      <Button
        height={44}
        borderRadius="$lg"
        backgroundColor="#FFFFFF"
        color="#000000"
        fontWeight="700"
        onPress={() => router.back()}
        pressStyle={{ opacity: 0.86, scale: 0.98 }}
      >
        Retour
      </Button>
    </YStack>
  );
}

export function StoryViewerScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userIdParam = typeof params.userId === 'string' ? params.userId : undefined;

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const storiesQuery = useStoriesFeed();
  const markViewed = useMarkStoryViewed();

  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);

  // Pause la story tant que la sheet « Vu par » est ouverte, reprend à la
  // fermeture. Pattern Insta : on ne veut pas que la story avance pendant
  // qu'on regarde la liste des viewers.
  const handleViewersOpenChange = useCallback((open: boolean) => {
    setViewersOpen(open);
    setIsPaused(open);
  }, []);

  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const markedSeenRef = useRef<Set<string>>(new Set());

  const groups: StoryUserGroup[] = useMemo(
    () => storiesQuery.data?.groups ?? [],
    [storiesQuery.data]
  );

  // Quand les groupes arrivent : positionne userIndex sur celui passé en
  // param + storyIndex sur sa 1re story non-vue (ou 0 si tout est vu).
  // Effet exécuté une seule fois grâce à la guard `userIndex === 0 && storyIndex === 0`.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || groups.length === 0) return;
    const targetIdx = userIdParam ? groups.findIndex((g) => g.author_id === userIdParam) : 0;
    const safeUserIdx = targetIdx >= 0 ? targetIdx : 0;
    const targetGroup = groups[safeUserIdx];
    if (!targetGroup) return;
    const firstUnseen = targetGroup.stories.findIndex((s) => !s.viewed_by_me);
    setUserIndex(safeUserIdx);
    setStoryIndex(firstUnseen >= 0 ? firstUnseen : 0);
    initRef.current = true;
  }, [groups, userIdParam]);

  const currentGroup = groups[userIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const goToNextStory = useCallback(() => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (userIndex < groups.length - 1) {
      setUserIndex(userIndex + 1);
      setStoryIndex(0);
    } else {
      // Dernière story du dernier user : on quitte la visionneuse.
      router.back();
    }
  }, [currentGroup, groups.length, storyIndex, userIndex]);

  const goToPreviousStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (userIndex > 0) {
      // 1re story d'un user → passe au précédent user, à sa DERNIÈRE story
      // (pattern Insta : pas à sa 1re, plus naturel quand on revient en arrière).
      const previousGroup = groups[userIndex - 1];
      if (previousGroup) {
        setUserIndex(userIndex - 1);
        setStoryIndex(previousGroup.stories.length - 1);
      }
    }
    // Sinon : déjà à la 1re story du 1er user, no-op.
  }, [groups, storyIndex, userIndex]);

  // Animation de la progress bar + auto-advance à la fin.
  useEffect(() => {
    if (!currentStory) return;
    progress.setValue(0);

    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: durationOf(currentStory),
      useNativeDriver: false,
    });

    if (!isPaused) {
      animationRef.current.start(({ finished }) => {
        if (finished) goToNextStory();
      });
    }

    return () => {
      animationRef.current?.stop();
    };
    // Note : on relance l'animation à chaque changement de story OU de
    // l'état pause. Quand on toggle pause, on stoppe et on recommence.
    // Pour un MVP simple c'est suffisant — l'amélioration "vraie pause"
    // qui reprend où on était est post-MVP.
  }, [currentStory, isPaused, progress, goToNextStory]);

  // Marquage seen : 1 seul appel par story (idempotent côté serveur, mais
  // évite quand même les requêtes inutiles).
  useEffect(() => {
    if (!currentStory) return;
    if (markedSeenRef.current.has(currentStory.id)) return;
    markedSeenRef.current.add(currentStory.id);
    markViewed.mutate(currentStory.id);
  }, [currentStory, markViewed]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handleOpenAuthor = useCallback(() => {
    if (!currentGroup) return;
    router.push(`/profile/${currentGroup.author_id}`);
  }, [currentGroup]);

  if (storiesQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <StatusBar hidden />
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  if (storiesQuery.isError || groups.length === 0 || !currentGroup || !currentStory) {
    return <ErrorState />;
  }

  const tapZoneWidth = width / 3;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <StoryBackground story={currentStory} isPaused={isPaused} />

      {/* Tap zones : 3 Pressable sans contenu, par-dessus le background.
          Importantes en premier dans le z-order pour intercepter les taps. */}
      <Pressable
        onPress={goToPreviousStory}
        style={[styles.tapZone, { width: tapZoneWidth, left: 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Story précédente"
        accessibilityHint="Tap pour revenir à la story précédente"
      />
      <Pressable
        onPress={handleTogglePause}
        style={[styles.tapZone, { width: tapZoneWidth, left: tapZoneWidth }]}
        accessibilityRole="button"
        accessibilityLabel={isPaused ? 'Reprendre' : 'Pause'}
        accessibilityHint={isPaused ? 'Tap pour reprendre la lecture' : 'Tap pour mettre en pause'}
      />
      <Pressable
        onPress={goToNextStory}
        style={[styles.tapZone, { width: tapZoneWidth, left: tapZoneWidth * 2 }]}
        accessibilityRole="button"
        accessibilityLabel="Story suivante"
        accessibilityHint="Tap pour passer à la story suivante"
      />

      {/* Overlays : progress bars + header. Sont au-dessus des tap zones. */}
      <View pointerEvents="box-none" style={[styles.overlayTop, { paddingTop: insets.top + 8 }]}>
        <ProgressBars
          count={currentGroup.stories.length}
          currentIndex={storyIndex}
          progress={progress}
        />

        <XStack
          alignItems="center"
          paddingHorizontal={16}
          marginTop={12}
          gap={10}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={handleOpenAuthor}
            style={styles.authorRow}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le profil de @${currentGroup.author_username}`}
          >
            {currentGroup.author_avatar_url ? (
              <Image
                source={{ uri: currentGroup.author_avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text color="#FFFFFF" fontSize={14} fontWeight="700">
                  {currentGroup.author_username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <YStack gap={2}>
              <Text color="#FFFFFF" fontSize={14} fontWeight="700">
                @{currentGroup.author_username}
              </Text>
              <Text color="rgba(255,255,255,0.72)" fontSize={11}>
                {formatRelativeTime(currentStory.created_at)}
              </Text>
            </YStack>
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={styles.closeButton}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </XStack>
      </View>

      {/* Footer « Vu par » — auteur seulement */}
      {currentGroup.is_mine ? (
        <Pressable
          onPress={() => handleViewersOpenChange(true)}
          accessibilityRole="button"
          accessibilityLabel="Voir qui a vu cette story"
          accessibilityHint="Voir la liste des personnes ayant vu cette story"
          style={[styles.viewersButton, { bottom: insets.bottom + 24 }]}
        >
          <Eye size={18} color="#FFFFFF" />
          <Text color="#FFFFFF" fontSize={13} fontWeight="700">
            Vu par
          </Text>
        </Pressable>
      ) : null}

      <StoryViewersSheet
        storyId={currentStory.id}
        open={viewersOpen}
        onOpenChange={handleViewersOpenChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerState: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersButton: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
