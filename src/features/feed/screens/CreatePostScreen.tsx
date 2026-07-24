// Écran « Créer un post » — E4-03, étendu à la vidéo par E14-01.
// Texte (≤ 500 car.) + jusqu'à 4 images OU 1 vidéo (galerie ou caméra).
// Compresse via uploadPostImage (E4-04) puis crée le post via useCreatePost
// (E4-05, qui invalide déjà le cache feed). Modale full-screen, header custom.
//
// IMAGES ET VIDÉO SONT EXCLUSIVES. `posts.media_type` est une colonne unique :
// un post mixte n'aurait pas de valeur correcte, et toutes les surfaces
// d'affichage (carte, grille de profil, détail) branchent dessus. Instagram
// applique la même règle. On refuse donc le mélange explicitement plutôt que
// de produire un post que l'app ne saurait pas afficher.
//
// Hors scope : hashtags #, géoloc, audience, brouillons, montage vidéo,
// preview plein écran d'une image (optionnel MVP du ticket).
// Mentions @ : ajoutées via ticket #213 (PR B) — dropdown au-dessus du clavier.

import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import { Camera, Image as ImageIcon, Play, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ScrollView, Text, TextArea, XStack, YStack } from 'tamagui';

import { useCreatePost } from '@/features/feed/hooks/useCreatePost';
import { buildVideoMediaUrls } from '@/features/feed/lib/postMedia';
import { generateVideoPoster } from '@/features/feed/lib/videoPoster';
import { MentionSuggestionsList } from '@/features/mentions/components/MentionSuggestionsList';
import { useMentionSuggestions } from '@/features/mentions/hooks/useMentionSuggestions';
import {
  countMentions,
  MAX_MENTIONS_PER_CONTENT,
} from '@/features/mentions/schemas/mentionsSchema';
import { useCurrentProfile } from '@/features/profile/hooks/useProfile';
import type { SearchUserResult } from '@/features/profile/hooks/useSearchUsers';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { uploadPostImage, uploadPostVideo } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Constantes & types
// ---------------------------------------------------------------------------

const MAX_IMAGES = 4;
/**
 * Durée max d'une vidéo de post (secondes).
 *
 * Plus généreux que les stories (15 s) : une story est éphémère et consommée
 * d'un doigt, un post est du contenu qu'on revient voir. 60 s est la borne
 * courante du format court.
 *
 * C'est la VRAIE limite produit. Le `file_size_limit` du bucket (100 Mo) est
 * un garde-fou serveur, pas un équivalent : une vidéo très compressée peut
 * durer dix minutes en pesant moins de 100 Mo.
 */
const MAX_VIDEO_SECS = 60;
const MAX_CONTENT = 500;
const COUNTER_THRESHOLD = 400;
const BRAND_GREEN = '#10D970';
const ERROR_RED = '#EF4444';

interface MediaItem {
  kind: 'image' | 'video';
  uri: string;
  width: number;
  height: number;
  /**
   * Vidéo uniquement — image de couverture locale, générée après sélection.
   *   undefined → génération en cours
   *   string    → poster prêt
   *   null      → génération tentée puis échouée (on publiera sans poster)
   */
  posterUri?: string | null;
  status: 'idle' | 'uploading' | 'done' | 'failed';
  result?: { publicUrl: string; path: string };
  /** Vidéo uniquement — résultat de l'upload du poster. */
  posterResult?: { publicUrl: string; path: string };
  error?: string;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CreatePostScreen() {
  const t = useTranslations();
  const navigation = useNavigation();
  const profileQuery = useCurrentProfile();
  const createPost = useCreatePost();

  const [content, setContent] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { activeQuery, suggestions, isLoading, replaceMention } = useMentionSuggestions(
    content,
    selection.end
  );

  const mentionsCount = countMentions(content);
  const tooManyMentions = mentionsCount > MAX_MENTIONS_PER_CONTENT;

  const handleSuggestionPick = (user: SearchUserResult) => {
    const next = replaceMention(user.username);
    setContent(next.text);
    setSelection({ start: next.cursor, end: next.cursor });
  };

  const abortRef = useRef<AbortController | null>(null);
  // Flag pour court-circuiter la confirmation quand la nav est déjà validée.
  const allowRemoveRef = useRef(false);

  const hasContent = content.trim().length > 0 || media.length > 0;
  const isAnyUploading = media.some((m) => m.status === 'uploading');
  const hasVideo = media.some((m) => m.kind === 'video');
  /** Vidéo → 1 média max ; images → 4. Pilote l'état grisé de la toolbar. */
  const isMediaFull = hasVideo || media.length >= MAX_IMAGES;
  /** Le poster se génère en tâche de fond : on ne bloque pas la publication
   *  dessus (un post vidéo sans poster reste valide), mais on l'indique. */
  const isPreparingVideo = media.some((m) => m.kind === 'video' && m.posterUri === undefined);
  const publishDisabled = !hasContent || isPublishing || isAnyUploading || tooManyMentions;
  const profile = profileQuery.data;

  // Intercepte sortie d'écran (X, back hardware, swipe) si du contenu en cours.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (allowRemoveRef.current) return;
      if (isPublishing) {
        // Annule les uploads en vol, laisse la nav passer.
        abortRef.current?.abort();
        return;
      }
      if (!hasContent) return;
      e.preventDefault();
      Alert.alert(t.feed.createPost.discardTitle, undefined, [
        { text: t.feed.createPost.cancel, style: 'cancel' },
        {
          text: t.feed.createPost.confirm,
          style: 'destructive',
          onPress: () => {
            allowRemoveRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
  }, [navigation, hasContent, isPublishing, t]);

  // -------------------------------------------------------------------------
  // Handlers — close & pickers
  // -------------------------------------------------------------------------

  const handleClose = () => router.back();

  /**
   * Lance la génération du poster en tâche de fond et le range dans l'item.
   * Volontairement non bloquant : l'utilisateur peut écrire son texte pendant
   * ce temps. En cas d'échec on inscrit `null` — la publication continuera
   * sans couverture plutôt que d'être refusée.
   */
  const attachPoster = (videoUri: string) => {
    void generateVideoPoster(videoUri).then((posterUri) => {
      setMedia((prev) => prev.map((m) => (m.uri === videoUri ? { ...m, posterUri } : m)));
    });
  };

  /** Refuse un mélange images + vidéo (cf. en-tête de fichier). */
  const rejectMixedMedia = (): boolean => {
    if (media.length === 0) return false;
    Alert.alert(t.feed.createPost.videoWithImagesTitle, t.feed.createPost.videoWithImagesMessage);
    return true;
  };

  /** Contrôle de durée commun galerie/caméra. `duration` est en millisecondes. */
  const isVideoTooLong = (durationMs: number | null | undefined): boolean => {
    // Le picker ne renvoie pas toujours la durée (notamment sur Android). Sans
    // information, on laisse passer : `videoMaxDuration` a déjà borné la
    // capture, et un faux refus serait pire qu'une vidéo un peu trop longue.
    if (!durationMs) return false;
    if (durationMs / 1000 <= MAX_VIDEO_SECS) return false;
    Alert.alert(
      t.feed.createPost.videoTooLongTitle,
      t.feed.createPost.videoTooLongMessage(MAX_VIDEO_SECS)
    );
    return true;
  };

  const pickFromLibrary = async () => {
    if (isMediaFull || isPublishing) return;
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      logger.warn('Media library permission denied');
      Alert.alert(t.feed.createPost.photoPermissionTitle, t.feed.createPost.videoPermissionMessage);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        videoMaxDuration: MAX_VIDEO_SECS,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - media.length,
        quality: 1, // compression côté uploadPostImage
      });
      if (result.canceled) return;

      // Une vidéo dans la sélection ⇒ elle prend tout le post. On ignore les
      // images sélectionnées en même temps plutôt que de publier un post mixte.
      const video = result.assets.find((a) => a.type === 'video');
      if (video) {
        if (rejectMixedMedia()) return;
        if (isVideoTooLong(video.duration)) return;
        setMedia([
          {
            kind: 'video',
            uri: video.uri,
            width: video.width,
            height: video.height,
            status: 'idle',
          },
        ]);
        attachPoster(video.uri);
        return;
      }

      const remaining = MAX_IMAGES - media.length;
      const newItems: MediaItem[] = result.assets
        .filter((a) => !media.some((m) => m.uri === a.uri))
        .slice(0, remaining)
        .map((a) => ({
          kind: 'image' as const,
          uri: a.uri,
          width: a.width,
          height: a.height,
          status: 'idle' as const,
        }));
      if (newItems.length > 0) setMedia((prev) => [...prev, ...newItems]);
    } catch (err) {
      logger.error('image_picker_library_failed', err);
    }
  };

  const pickFromCamera = async () => {
    if (isMediaFull || isPublishing) return;
    let perm = await ImagePicker.getCameraPermissionsAsync();
    if (!perm.granted) perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      logger.warn('Camera permission denied');
      Alert.alert(
        t.feed.createPost.photoPermissionTitle,
        t.feed.createPost.cameraPermissionMessage
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        videoMaxDuration: MAX_VIDEO_SECS,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      if (asset.type === 'video') {
        if (rejectMixedMedia()) return;
        if (isVideoTooLong(asset.duration)) return;
        setMedia([
          {
            kind: 'video',
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            status: 'idle',
          },
        ]);
        attachPoster(asset.uri);
        return;
      }

      setMedia((prev) => [
        ...prev,
        {
          kind: 'image' as const,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          status: 'idle' as const,
        },
      ]);
    } catch (err) {
      logger.error('image_picker_camera_failed', err);
    }
  };

  const removeMedia = (uri: string) => {
    setMedia((prev) => prev.filter((m) => m.uri !== uri));
  };

  // -------------------------------------------------------------------------
  // Flux publier — upload parallèle (skip 'done') puis mutation INSERT.
  // -------------------------------------------------------------------------

  const handlePublish = async () => {
    if (isPublishing || !hasContent) return;
    setIsPublishing(true);
    setPublishError(null);
    abortRef.current = new AbortController();

    // UI : marquer 'uploading' les médias non encore 'done'.
    setMedia((prev) =>
      prev.map((m) =>
        m.status === 'done' ? m : { ...m, status: 'uploading' as const, error: undefined }
      )
    );

    const signal = abortRef.current.signal;
    const settled = await Promise.allSettled(
      media.map(async (m): Promise<MediaItem> => {
        if (m.status === 'done') return m;

        if (m.kind === 'video') {
          // Le poster passe par uploadPostImage : c'est un JPEG ordinaire, il
          // profite donc de la même compression et du même retry/backoff.
          let posterResult = m.posterResult;
          if (!posterResult && m.posterUri) {
            try {
              posterResult = await uploadPostImage(m.posterUri, { signal });
            } catch (err) {
              // Un poster manquant dégrade l'affichage, il ne casse rien : on
              // publie la vidéo sans couverture plutôt que d'échouer.
              if (signal.aborted) throw err;
              logger.warn('post_video_poster_upload_failed', {
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }
          const res = await uploadPostVideo(m.uri, { signal });
          return { ...m, status: 'done' as const, result: res, posterResult };
        }

        const res = await uploadPostImage(m.uri, { signal });
        return { ...m, status: 'done' as const, result: res };
      })
    );

    // Si abort entre-temps : on a déjà laissé la nav partir (beforeRemove).
    if (signal.aborted) {
      setIsPublishing(false);
      return;
    }

    const updated: MediaItem[] = media.map((m, i) => {
      const s = settled[i];
      if (!s) return m;
      if (s.status === 'fulfilled') return s.value;
      return {
        ...m,
        status: 'failed' as const,
        error: s.reason instanceof Error ? s.reason.message : 'upload',
      };
    });
    setMedia(updated);

    const failed = updated.filter((m) => m.status === 'failed');
    if (failed.length > 0) {
      setPublishError(t.feed.createPost.uploadFailed(failed.length));
      setIsPublishing(false);
      return;
    }

    // Un post vidéo suit la convention de `postMedia.ts` : [poster, vidéo].
    // Si le poster manque (génération ou upload en échec), on n'envoie que la
    // vidéo — `getPostVideoUrl` sait retomber sur l'unique URL.
    const videoItem = updated.find((m) => m.kind === 'video');
    const videoUrl = videoItem?.result?.publicUrl;

    let mediaUrls: string[];
    let mediaType: 'text' | 'image' | 'video';

    if (videoUrl) {
      const posterUrl = videoItem?.posterResult?.publicUrl;
      mediaUrls = posterUrl ? buildVideoMediaUrls(posterUrl, videoUrl) : [videoUrl];
      mediaType = 'video';
    } else {
      mediaUrls = updated
        .map((m) => m.result?.publicUrl)
        .filter((u): u is string => typeof u === 'string');
      mediaType = mediaUrls.length > 0 ? 'image' : 'text';
    }

    createPost.mutate(
      {
        content: content.trim(),
        media_urls: mediaUrls,
        media_type: mediaType,
      },
      {
        onSuccess: () => {
          // useCreatePost invalide déjà ['feed'] — on rentre au feed.
          allowRemoveRef.current = true;
          router.back();
        },
        onError: (e) => {
          setPublishError(e.message);
          setIsPublishing(false);
        },
      }
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const counterColor = content.length >= MAX_CONTENT ? ERROR_RED : '$placeholderColor';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <YStack flex={1} backgroundColor="$background">
          {/* Header */}
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <YStack onPress={handleClose} pressStyle={{ opacity: 0.6 }} padding="$2">
              <X size={24} color="#FFFFFF" />
            </YStack>
            <Text fontSize={17} fontWeight="700" color="$color">
              {t.feed.createPost.title}
            </Text>
            <Button
              onPress={() => void handlePublish()}
              disabled={publishDisabled}
              backgroundColor={publishDisabled ? '$backgroundFocus' : BRAND_GREEN}
              color={publishDisabled ? '$color' : '#000000'}
              opacity={publishDisabled ? 0.5 : 1}
              size="$3"
              borderRadius="$10"
              paddingHorizontal="$4"
            >
              {isPublishing ? <ActivityIndicator color="#000000" /> : t.feed.createPost.publish}
            </Button>
          </XStack>

          {/* Auteur */}
          <XStack alignItems="center" paddingHorizontal="$3" paddingVertical="$2" gap="$3">
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <YStack style={styles.avatar} backgroundColor="$backgroundFocus" />
            )}
            <Text fontSize={15} fontWeight="600" color="$color">
              @{profile?.username ?? '…'}
            </Text>
          </XStack>

          {/* TextArea */}
          <YStack flex={1} position="relative">
            <TextArea
              flex={1}
              value={content}
              selection={selection}
              onChangeText={setContent}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              maxLength={MAX_CONTENT}
              placeholder={t.feed.createPost.contentPlaceholder}
              placeholderTextColor="$placeholderColor"
              autoFocus
              autoCapitalize="sentences"
              autoCorrect
              editable={!isPublishing}
              fontSize={17}
              lineHeight={24}
              color="$color"
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal="$3"
              textAlignVertical="top"
            />
            {content.length > COUNTER_THRESHOLD ? (
              <Text position="absolute" bottom="$2" right="$3" fontSize={13} color={counterColor}>
                {content.length}/{MAX_CONTENT}
              </Text>
            ) : null}
          </YStack>

          {/* Previews */}
          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              paddingHorizontal="$3"
              paddingVertical="$2"
            >
              <XStack gap="$2">
                {media.map((m) => (
                  <YStack key={m.uri} width={120} height={120} position="relative">
                    {/* Pour une vidéo, `m.uri` est un .mp4 : le donner à <Image>
                        n'afficherait rien. On montre le poster dès qu'il est
                        prêt, sur une tuile sombre en attendant. */}
                    {m.kind === 'video' ? (
                      <YStack style={styles.preview} backgroundColor="#111111" overflow="hidden">
                        {m.posterUri ? (
                          <Image source={{ uri: m.posterUri }} style={styles.preview} />
                        ) : null}
                        <YStack
                          position="absolute"
                          top={0}
                          left={0}
                          right={0}
                          bottom={0}
                          alignItems="center"
                          justifyContent="center"
                          pointerEvents="none"
                        >
                          <YStack
                            width={36}
                            height={36}
                            borderRadius={18}
                            backgroundColor="rgba(0,0,0,0.45)"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                          </YStack>
                        </YStack>
                      </YStack>
                    ) : (
                      <Image source={{ uri: m.uri }} style={styles.preview} />
                    )}
                    {m.status === 'uploading' ? (
                      <YStack
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="rgba(0,0,0,0.5)"
                        borderRadius={12}
                      >
                        <ActivityIndicator color="#FFFFFF" />
                      </YStack>
                    ) : null}
                    {m.status === 'failed' ? (
                      <YStack
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="rgba(239,68,68,0.4)"
                        borderRadius={12}
                      >
                        <Text fontSize={28}>⚠️</Text>
                      </YStack>
                    ) : null}
                    {m.status !== 'uploading' ? (
                      <YStack
                        position="absolute"
                        top={4}
                        right={4}
                        width={24}
                        height={24}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="rgba(0,0,0,0.7)"
                        borderRadius={12}
                        onPress={() => removeMedia(m.uri)}
                        pressStyle={{ opacity: 0.6 }}
                      >
                        <X size={14} color="#FFFFFF" />
                      </YStack>
                    ) : null}
                  </YStack>
                ))}
              </XStack>
            </ScrollView>
          ) : null}

          {/* Bandeau d'erreur (avec Réessayer) */}
          {publishError ? (
            <XStack
              alignItems="center"
              backgroundColor="rgba(239,68,68,0.15)"
              paddingHorizontal="$3"
              paddingVertical="$2"
              gap="$3"
              borderTopWidth={1}
              borderColor="rgba(239,68,68,0.3)"
            >
              <Text flex={1} color={ERROR_RED} fontSize={14}>
                {publishError}
              </Text>
              <Button
                onPress={() => void handlePublish()}
                disabled={publishDisabled}
                opacity={publishDisabled ? 0.5 : 1}
                size="$2"
                backgroundColor={ERROR_RED}
                color="#FFFFFF"
              >
                {t.feed.createPost.retry}
              </Button>
            </XStack>
          ) : null}

          {/* Dropdown suggestions @mentions (au-dessus de la toolbar) */}
          <MentionSuggestionsList
            suggestions={suggestions}
            isLoading={isLoading}
            visible={activeQuery !== null}
            onSelect={handleSuggestionPick}
          />

          {/* Garde-fou max 5 mentions */}
          {tooManyMentions ? (
            <XStack
              alignItems="center"
              backgroundColor="rgba(239,68,68,0.15)"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderTopWidth={1}
              borderColor="rgba(239,68,68,0.3)"
            >
              <Text flex={1} color={ERROR_RED} fontSize={13}>
                {t.feed.createPost.tooManyMentions(MAX_MENTIONS_PER_CONTENT)}
              </Text>
            </XStack>
          ) : null}

          {/* Toolbar */}
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderTopWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
          >
            <XStack gap="$3">
              <YStack
                onPress={isMediaFull || isPublishing ? undefined : pickFromCamera}
                opacity={isMediaFull || isPublishing ? 0.3 : 1}
                padding="$2"
                pressStyle={{ opacity: 0.6 }}
              >
                <Camera size={24} color="#FFFFFF" />
              </YStack>
              <YStack
                onPress={isMediaFull || isPublishing ? undefined : pickFromLibrary}
                opacity={isMediaFull || isPublishing ? 0.3 : 1}
                padding="$2"
                pressStyle={{ opacity: 0.6 }}
              >
                <ImageIcon size={24} color="#FFFFFF" />
              </YStack>
            </XStack>
            {media.length > 0 ? (
              <Text fontSize={13} color="$placeholderColor">
                {hasVideo
                  ? isPreparingVideo
                    ? t.feed.createPost.videoPreparing
                    : t.feed.createPost.videoLabel
                  : t.feed.createPost.imagesCount(media.length, MAX_IMAGES)}
              </Text>
            ) : null}
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles statiques (les valeurs non thématiques restent en StyleSheet).
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  preview: { width: 120, height: 120, borderRadius: 12 },
});
