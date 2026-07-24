// Génération de l'image de couverture d'une vidéo — E14-01.
//
// `expo-video` sait extraire une frame (`generateThumbnailsAsync`), mais il la
// renvoie en `VideoThumbnail`, c'est-à-dire une référence à une image NATIVE —
// pas un fichier sur le disque. On ne peut donc pas l'uploader telle quelle.
//
// `expo-image-manipulator` accepte justement une SharedRef<'image'> en entrée
// (API `manipulate`, non dépréciée), ce qui permet de la matérialiser en JPEG :
//
//   VideoThumbnail  →  manipulate()  →  renderAsync()  →  saveAsync()  →  uri
//
// Aucun package supplémentaire : expo-video et expo-image-manipulator sont
// déjà dans la stack (respectivement pour les stories et pour la compression
// des images de post).

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

import { logger } from '@/lib/logger';

/**
 * Instant de la frame extraite (secondes).
 *
 * Pas 0 : la toute première frame d'une vidéo est très souvent noire (fondu
 * d'ouverture, capteur pas encore exposé sur une capture caméra). Une demi-
 * seconde suffit à obtenir une image représentative, et reste dans les clous
 * même pour une vidéo très courte — le natif borne la valeur à la durée réelle.
 */
const POSTER_TIME_SECS = 0.5;

/** Largeur max du poster. Au-delà, on paierait de la bande passante pour rien. */
const POSTER_MAX_WIDTH = 1080;

/** Qualité JPEG du poster. */
const POSTER_QUALITY = 0.8;

/**
 * Extrait une image de couverture d'une vidéo locale et la sauve en JPEG.
 *
 * Retourne l'URI locale du JPEG, ou `null` si l'extraction échoue.
 *
 * Le `null` est volontaire et ne doit PAS être traité comme une erreur fatale :
 * un post vidéo sans poster reste lisible (cf. `getPostVideoUrl`, qui retombe
 * sur l'unique URL). Mieux vaut un post publié sans vignette qu'une publication
 * refusée parce que l'extraction d'une frame a échoué sur un codec exotique.
 */
export async function generateVideoPoster(videoUri: string): Promise<string | null> {
  let player: ReturnType<typeof createVideoPlayer> | null = null;
  try {
    player = createVideoPlayer(videoUri);

    const thumbnails = await player.generateThumbnailsAsync([POSTER_TIME_SECS], {
      maxWidth: POSTER_MAX_WIDTH,
    });
    const thumbnail = thumbnails[0];
    if (!thumbnail) return null;

    const rendered = await ImageManipulator.manipulate(thumbnail).renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: POSTER_QUALITY,
    });
    return saved.uri;
  } catch (err) {
    logger.warn('video_poster_generation_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    // Un VideoPlayer est un objet natif : sans release() il survit au GC JS et
    // garde le décodeur ouvert.
    player?.release();
  }
}
