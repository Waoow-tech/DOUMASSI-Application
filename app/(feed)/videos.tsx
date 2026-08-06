// Défilement vidéo plein écran — E14-02.
//
// Ouvert en tapant une vidéo dans le feed social. On atterrit sur la vidéo
// tapée, puis on fait défiler verticalement vers les vidéos plus anciennes.
//
// Choix produit (validé CTO) : PAS d'onglet Reels séparé. Les vidéos vivent
// dans le feed social et s'ouvrent en plein écran — une surface de moins à
// alimenter, et pas de fil parallèle à modérer.
//
// ---------------------------------------------------------------------------
// LE POINT CRITIQUE : LE CYCLE DE VIE DES LECTEURS
// ---------------------------------------------------------------------------
// Un VideoPlayer est un objet natif qui tient un décodeur. En monter un par
// cellule d'une liste virtualisée fait grimper la mémoire jusqu'au crash au
// bout de quelques dizaines d'éléments — c'est LE piège de ce genre d'écran.
//
// Deux garde-fous ici :
//   1. `VideoView` n'est monté que pour la page active et ses voisines
//      immédiates (fenêtre de ±1, donc 3 lecteurs vivants au maximum).
//      Les autres pages n'affichent que leur poster.
//   2. Seule la page active joue ; les voisines sont préchargées en pause.
//
// `useVideoPlayer` libère le lecteur au démontage : c'est la fenêtre qui fait
// le ménage, on n'a pas de release() manuel à orchestrer.

import { FlashList, type ViewToken } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, YStack } from 'tamagui';

import type { PostCardPost } from '@/components/feed/PostCard';
import { InternalShareOptionsSheet } from '@/components/share/InternalShareOptionsSheet';
import { CommentsSheet } from '@/features/comments/components/CommentsSheet';
import {
  BottomScrim,
  HIT_SLOP,
  PostActionRail,
  PostFooter,
} from '@/features/feed/components/FullScreenPostOverlay';
import {
  useIncrementPostShare,
  usePostDetail,
  useTogglePostBookmark,
  useTogglePostLike,
} from '@/features/feed/hooks/useFeed';
import { useVideoFeed } from '@/features/feed/hooks/useVideoFeed';
import { getPostPosterUrl, getPostVideoUrl } from '@/features/feed/lib/postMedia';
import { useTranslations } from '@/i18n';

/** Nombre de pages de part et d'autre de l'active qui montent un vrai lecteur. */
const PLAYER_WINDOW = 1;

// ---------------------------------------------------------------------------
// Une page = une vidéo plein écran
// ---------------------------------------------------------------------------

function VideoPage({
  post,
  height,
  isActive,
  withPlayer,
  onOpenComments,
  onOpenShare,
}: {
  post: PostCardPost;
  height: number;
  /** Page visible → lecture. Les autres restent en pause. */
  isActive: boolean;
  /** Page dans la fenêtre → monte un VideoView. Sinon, poster seul. */
  withPlayer: boolean;
  onOpenComments: (postId: string) => void;
  onOpenShare: (post: PostCardPost) => void;
}) {
  const posterUrl = getPostPosterUrl(post);

  const likeMutation = useTogglePostLike(post.id);
  const bookmarkMutation = useTogglePostBookmark(post.id);

  const handleLike = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeMutation.mutate();
  }, [likeMutation]);

  const handleBookmark = useCallback(() => {
    void Haptics.selectionAsync();
    bookmarkMutation.mutate();
  }, [bookmarkMutation]);

  const handleOpenProfile = useCallback(() => {
    router.push(`/profile/${post.author_id}`);
  }, [post.author_id]);

  return (
    <View style={{ height }}>
      {/* Le poster reste sous la vidéo : il masque le flash noir pendant que le
          décodeur s'amorce, et il EST l'affichage des pages hors fenêtre. */}
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={styles.emptyBackground} />
      )}

      {withPlayer ? <VideoLayer post={post} isActive={isActive} /> : null}

      <BottomScrim />

      <PostActionRail
        post={post}
        onLike={handleLike}
        onComments={() => onOpenComments(post.id)}
        onShare={() => onOpenShare(post)}
        onBookmark={handleBookmark}
      />

      <PostFooter post={post} onOpenProfile={handleOpenProfile} />
    </View>
  );
}

/**
 * Couche vidéo isolée dans son propre composant : `useVideoPlayer` n'est monté
 * que quand la page entre dans la fenêtre, et libéré dès qu'elle en sort.
 * Le mettre dans VideoPage créerait un lecteur pour CHAQUE page rendue.
 */
function VideoLayer({ post, isActive }: { post: PostCardPost; isActive: boolean }) {
  const videoUrl = getPostVideoUrl(post);

  const player = useVideoPlayer(videoUrl ?? null, (instance) => {
    instance.loop = true;
    // Muet par défaut : une vidéo qui démarre avec le son dans un lieu public
    // est la première raison de refermer l'app. Même parti pris que l'écran de
    // détail d'un post.
    instance.muted = true;
  });

  // Seule la page active joue. Les voisines restent montées mais en pause :
  // elles sont donc déjà décodées quand on arrive dessus, sans consommer de
  // CPU en attendant.
  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  if (!videoUrl) return null;

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function VideoFeedRoute() {
  const t = useTranslations();
  const params = useLocalSearchParams<{ postId?: string }>();
  const postId = typeof params.postId === 'string' ? params.postId : undefined;
  const insets = useSafeAreaInsets();

  const { height } = Dimensions.get('window');

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);

  // La vidéo d'entrée : elle ouvre la liste, et son `created_at` sert de
  // curseur pour la suite. On ne dépend donc pas de sa présence dans la 1re
  // page du fil vidéo — elle peut être bien plus ancienne.
  const entryQuery = usePostDetail(postId);
  const entryPost = entryQuery.data ?? null;

  const feedQuery = useVideoFeed(entryPost ? entryPost.created_at : undefined);

  const posts = useMemo(() => {
    if (!entryPost) return [];
    const rest = (feedQuery.data?.pages ?? []).flatMap((page) => page.posts);
    // `get_video_feed` ne renvoie que du STRICTEMENT plus ancien que le
    // curseur : aucun doublon possible avec la vidéo d'entrée.
    return [entryPost, ...rest];
  }, [entryPost, feedQuery.data]);

  const shareMutation = useIncrementPostShare(sharePost?.id ?? '');

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<PostCardPost>[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    }
  ).current;

  const handleLoadMore = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleShareOutside = useCallback(async () => {
    const post = sharePost;
    if (!post) return;
    try {
      const result = await Share.share({
        message: post.content.trim()
          ? `${post.content}\n\nhttps://doumassi.app/post/${post.id}`
          : `https://doumassi.app/post/${post.id}`,
      });
      if (result.action === Share.sharedAction) shareMutation.mutate();
    } catch {
      // Annulation par l'utilisateur ou erreur native.
    }
  }, [sharePost, shareMutation]);

  const handleShareInside = useCallback(() => {
    if (!sharePost) return;
    router.push({
      pathname: '/messages/share',
      params: { type: 'post', postId: sharePost.id },
    });
  }, [sharePost]);

  if (entryQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <StatusBar hidden />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (entryQuery.isError || !entryPost) {
    return (
      <View style={styles.centerState}>
        <StatusBar hidden />
        <YStack alignItems="center" gap="$3" padding="$5">
          <Text color="#FFFFFF" fontSize={16} fontWeight="700" textAlign="center">
            {t.feed.postDetail.errorTitle}
          </Text>
          <Pressable onPress={handleClose} hitSlop={HIT_SLOP} accessibilityRole="button">
            <Text color="#FFFFFF" fontSize={15} fontWeight="700">
              {t.feed.postDetail.back}
            </Text>
          </Pressable>
        </YStack>
      </View>
    );
  }

  return (
    <>
      <View style={styles.screen}>
        <StatusBar hidden />

        <FlashList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <VideoPage
              post={item}
              height={height}
              isActive={index === activeIndex}
              withPlayer={Math.abs(index - activeIndex) <= PLAYER_WINDOW}
              onOpenComments={setCommentsPostId}
              onOpenShare={setSharePost}
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={1.5}
        />

        <Pressable
          onPress={handleClose}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.feed.postDetail.closeA11y}
          style={[styles.closeButton, { top: insets.top + 12 }]}
        >
          <X size={24} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </View>

      {commentsPostId ? (
        <CommentsSheet
          postId={commentsPostId}
          open={commentsPostId !== null}
          onOpenChange={(open) => {
            if (!open) setCommentsPostId(null);
          }}
        />
      ) : null}

      <InternalShareOptionsSheet
        open={sharePost !== null}
        onOpenChange={(open) => {
          if (!open) setSharePost(null);
        }}
        onShareOutside={() => void handleShareOutside()}
        onShareInside={handleShareInside}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
