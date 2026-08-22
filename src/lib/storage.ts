// Service uploadPostImage — E4-04.
// Compresse une image locale (resize ≤ 1920 px + JPEG, cible < 500 Ko) via
// expo-image-manipulator, puis l'upload dans le bucket Supabase Storage
// `posts` au path {user_id}/{uuid}.jpg. Retourne l'URL publique + le path.
//
// Choix d'archi (validés CTO, cf. E4-04) :
//  - Upload « brut » via expo-file-system (createUploadTask) plutôt que
//    supabase.storage.upload() : seul createUploadTask expose la progression
//    d'octets, requise par le ticket. On POST sur l'endpoint REST Storage,
//    et le retry/backoff est implémenté autour de createUploadTask.
//  - Token de session récupéré FRAIS avant chaque tentative (jamais mis en
//    cache) : il peut expirer entre deux retries.
//
// Utilisé par E4-03 (création de post).

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { uuidv4 } from '@/lib/uuid';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BUCKET = 'posts';
/** Plus grand côté max après resize (px). Aucun upscale en dessous. */
const MAX_DIMENSION = 1920;
/** Taille cible après compression (octets). */
const TARGET_SIZE_BYTES = 500 * 1024;
/** Qualité JPEG de la 1re passe. */
const DEFAULT_QUALITY = 0.8;
/** Paliers de repli si le fichier dépasse encore la cible. */
const FALLBACK_QUALITIES = [0.6, 0.4];
/** Délai avant chaque tentative d'upload : 1 tentative + 3 retries (backoff). */
const RETRY_DELAYS_MS = [0, 1000, 2000, 4000];
/** Cache-Control des objets : nom UUID unique → contenu immuable, cache long. */
const CACHE_CONTROL = 'max-age=31536000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Étape ayant échoué — laisse le caller choisir le bon message utilisateur. */
export type UploadErrorStage = 'compression' | 'upload';

export interface UploadPostImageOptions {
  /** Callback de progression de l'upload, de 0 à 1 (monotone croissant). */
  onProgress?: (pct: number) => void;
  /** Qualité JPEG de la 1re passe (0–1). Défaut 0.8. */
  quality?: number;
  /**
   * Signal d'annulation. Quand il s'abort (ex. l'écran CreatePost est
   * démonté), l'upload natif en cours est annulé — pas d'upload zombie — et
   * la promesse rejette. Le caller distingue une annulation d'une vraie
   * erreur en testant `signal.aborted`.
   */
  signal?: AbortSignal;
}

export interface UploadPostImageResult {
  /** URL publique consultable de l'image. */
  publicUrl: string;
  /** Path dans le bucket ({user_id}/{uuid}.jpg) — sert à la suppression. */
  path: string;
}

/** Erreur typée remontée par `uploadPostImage`. */
export class UploadError extends Error {
  readonly stage: UploadErrorStage;

  constructor(stage: UploadErrorStage, cause: unknown) {
    super(`uploadPostImage : échec à l'étape « ${stage} »`, { cause });
    this.name = 'UploadError';
    this.stage = stage;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Attente interruptible : se termine tôt si `signal` s'abort. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort);
  });
}

/** Borne une valeur dans [0, 1]. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Erreur d'annulation volontaire (signal aborté). */
function abortedError(): UploadError {
  return new UploadError('upload', new Error('Upload annulé'));
}

/** Supprime des fichiers temporaires — best effort, n'échoue jamais. */
async function cleanupTempFiles(uris: string[]): Promise<void> {
  await Promise.all(
    uris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
  );
}

/**
 * Session courante. À rappeler avant chaque tentative d'upload : un token
 * mis en cache peut expirer entre deux retries — `getSession()` renvoie un
 * token rafraîchi si besoin.
 */
async function getFreshSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new UploadError('upload', error ?? new Error('Aucune session active'));
  }
  return data.session;
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/**
 * Resize (si le plus grand côté > 1920 px) + compression JPEG.
 * `manipulateAsync` applique l'orientation EXIF de la source : l'image de
 * sortie est donc déjà droite. Repasse en 0.6 puis 0.4 si > 500 Ko.
 * Les fichiers temporaires des passes intermédiaires sont supprimés.
 */
async function compressImage(uri: string, quality: number): Promise<string> {
  // URIs produites par manipulateAsync (jamais `uri`, qui appartient au caller).
  const temps: string[] = [];
  try {
    // 1re passe — compression à la qualité demandée, sans resize. L'ImageResult
    // expose width/height : on lit les dimensions via le manipulateur lui-même
    // (Image.getSize peut ne jamais résoudre sur certains fichiers locaux).
    let result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    temps.push(result.uri);

    // 2e passe — resize si le plus grand côté dépasse 1920 px (ratio conservé).
    if (result.width > MAX_DIMENSION || result.height > MAX_DIMENSION) {
      const resize: ImageManipulator.Action =
        result.width >= result.height
          ? { resize: { width: MAX_DIMENSION } }
          : { resize: { height: MAX_DIMENSION } };
      result = await ImageManipulator.manipulateAsync(result.uri, [resize], {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      temps.push(result.uri);
    }

    // Repli 0.6 puis 0.4 tant que le fichier dépasse 500 Ko.
    for (const fallback of FALLBACK_QUALITIES) {
      if (fallback >= quality) continue; // ne jamais « remonter » la qualité
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && info.size <= TARGET_SIZE_BYTES) break;
      result = await ImageManipulator.manipulateAsync(result.uri, [], {
        compress: fallback,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      temps.push(result.uri);
    }

    // On garde la dernière passe (result.uri), on supprime les intermédiaires.
    await cleanupTempFiles(temps.filter((t) => t !== result.uri));
    return result.uri;
  } catch (cause) {
    await cleanupTempFiles(temps);
    throw new UploadError('compression', cause);
  }
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Une tentative d'upload : POST `BINARY_CONTENT` sur l'endpoint REST Storage.
 * Câble l'annulation : si `signal` s'abort, la task native est annulée pour
 * ne pas laisser une requête zombie en arrière-plan.
 */
async function runUploadAttempt(
  url: string,
  localUri: string,
  accessToken: string,
  contentType: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal | undefined
) {
  const task = FileSystem.createUploadTask(
    url,
    localUri,
    {
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        // Les DEUX en-têtes sont requis, sinon Storage refuse la requête.
        apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Cache-Control': CACHE_CONTROL,
        'x-upsert': 'false',
      },
    },
    (data) => {
      if (data.totalBytesExpectedToSend > 0) {
        onProgress(data.totalBytesSent / data.totalBytesExpectedToSend);
      }
    }
  );

  const onAbort = () => {
    // cancelAsync peut rejeter si la task est déjà terminée → rejet ignoré.
    task.cancelAsync().catch(() => undefined);
  };
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener('abort', onAbort);
  }

  try {
    return await task.uploadAsync();
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Upload du fichier local dans le bucket Supabase Storage indiqué, avec progression.
 * Retry 3x (backoff exponentiel 1s/2s/4s). Token rafraîchi à chaque tentative.
 */
async function uploadToStorage(
  localUri: string,
  path: string,
  bucket: string,
  contentType: string,
  options: { onProgress?: (pct: number) => void; signal?: AbortSignal }
): Promise<void> {
  const { signal } = options;
  const url = `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  // Progression monotone : on n'émet jamais une valeur < à la précédente
  // (sinon la barre recule à chaque retry, qui repart de 0 octet).
  const rawOnProgress = options.onProgress;
  let lastProgress = 0;
  const emitProgress = (pct: number): void => {
    if (!rawOnProgress) return;
    const next = clamp01(pct);
    if (next > lastProgress) {
      lastProgress = next;
      rawOnProgress(next);
    }
  };

  let lastError: unknown;
  for (const [attempt, delayMs] of RETRY_DELAYS_MS.entries()) {
    if (signal?.aborted) throw abortedError();
    if (delayMs > 0) await sleep(delayMs, signal);
    if (signal?.aborted) throw abortedError();

    try {
      // Token FRAIS à chaque tentative (il peut expirer entre 2 retries).
      const { access_token } = await getFreshSession();
      const response = await runUploadAttempt(
        url,
        localUri,
        access_token,
        contentType,
        emitProgress,
        signal
      );

      // Upload physiquement terminé → succès, même si un abort tardif a eu lieu.
      if (response && response.status >= 200 && response.status < 300) {
        emitProgress(1);
        return;
      }
      if (signal?.aborted) throw abortedError();

      // Erreur HTTP : on logge le status code pour le debug Sentry.
      const status = response?.status ?? 0;
      const body = response?.body ?? '';
      logger.error('upload_post_image_attempt_failed', { attempt, status, body, path });
      lastError = new Error(`Échec upload Storage : HTTP ${status} — ${body}`);
    } catch (err) {
      // Annulation ou absence de session → inutile de retenter / de logger.
      if (err instanceof UploadError) throw err;
      if (signal?.aborted) throw abortedError();
      logger.error('upload_post_image_attempt_failed', {
        attempt,
        error: err instanceof Error ? err.message : String(err),
        path,
      });
      lastError = err;
    }
  }

  throw new UploadError('upload', lastError);
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Compresse puis upload une image locale dans le bucket `posts`.
 *
 * @param uri      URI locale (file://) de l'image — ex. résultat d'ImagePicker.
 * @param options  `onProgress` (0 → 1), `quality` (défaut 0.8), `signal`
 *                 (annulation).
 * @returns        URL publique + path dans le bucket.
 * @throws UploadError — `stage` vaut 'compression' ou 'upload'. En cas
 *         d'annulation via `signal`, tester `signal.aborted` pour la
 *         distinguer d'une vraie erreur.
 */
export async function uploadPostImage(
  uri: string,
  options?: UploadPostImageOptions
): Promise<UploadPostImageResult> {
  const quality = clamp01(options?.quality ?? DEFAULT_QUALITY);
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  try {
    if (signal?.aborted) throw abortedError();

    // user.id sert au path. Le token, lui, est rafraîchi à chaque tentative
    // d'upload (cf. uploadToStorage) — on ne réutilise pas celui d'ici.
    const session = await getFreshSession();
    const compressedUri = await compressImage(uri, quality);
    const path = `${session.user.id}/${uuidv4()}.jpg`;

    try {
      await uploadToStorage(compressedUri, path, BUCKET, 'image/jpeg', { onProgress, signal });
    } finally {
      // L'image compressée est traitée (uploadée ou échec) → on libère le temp.
      await cleanupTempFiles([compressedUri]);
    }

    // getPublicUrl ne fait pas d'appel réseau (construction d'URL locale).
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);

    if (signal?.aborted) {
      // Annulation volontaire (écran démonté) : pas une vraie erreur, on
      // n'envoie pas de bruit à Sentry.
      logger.debug('upload_post_image_cancelled');
    } else {
      logger.error('upload_post_image_failed', uploadError);
    }
    throw uploadError;
  }
}

// ---------------------------------------------------------------------------
// Pièce jointe image du chat IA — E5-06
// ---------------------------------------------------------------------------

const AI_ATTACHMENTS_BUCKET = 'ai-attachments';

export interface UploadAiImageResult {
  /** Path dans le bucket PRIVÉ ({user_id}/{uuid}.jpg). Pas d'URL publique :
   *  le bucket est privé, on signe à la demande (serveur pour la Vision,
   *  client pour l'affichage). */
  path: string;
}

/**
 * Compresse puis upload une image dans le bucket PRIVÉ `ai-attachments`.
 * Même pipeline que uploadPostImage, mais on ne renvoie PAS d'URL publique
 * (le bucket est privé — cf. migration 20260729120000).
 */
export async function uploadAiImage(
  uri: string,
  options?: { signal?: AbortSignal }
): Promise<UploadAiImageResult> {
  const signal = options?.signal;
  try {
    if (signal?.aborted) throw abortedError();

    const session = await getFreshSession();
    const compressedUri = await compressImage(uri, DEFAULT_QUALITY);
    const path = `${session.user.id}/${uuidv4()}.jpg`;

    try {
      await uploadToStorage(compressedUri, path, AI_ATTACHMENTS_BUCKET, 'image/jpeg', { signal });
    } finally {
      await cleanupTempFiles([compressedUri]);
    }

    return { path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) {
      logger.debug('upload_ai_image_cancelled');
    } else {
      logger.error('upload_ai_image_failed', uploadError);
    }
    throw uploadError;
  }
}

/**
 * URL signée à courte durée pour afficher une pièce jointe (bucket privé).
 * Retourne null en cas d'échec (l'UI affiche alors un placeholder).
 */
export async function signAiAttachment(path: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AI_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) {
    logger.warn('sign_ai_attachment_failed', { message: error.message });
    return null;
  }
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Vidéo de post — E14-01
// ---------------------------------------------------------------------------

export interface UploadPostVideoResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload une vidéo locale dans le bucket `posts`.
 *
 * Contrairement aux images, la vidéo n'est PAS recompressée : ré-encoder côté
 * téléphone coûte très cher en temps et en batterie, et dégrade la qualité pour
 * un gain incertain. On s'appuie sur la compression déjà appliquée par la
 * caméra/le picker, et on borne le risque en amont (durée max côté écran,
 * `file_size_limit` du bucket côté serveur).
 *
 * Le type MIME est déduit de l'extension : l'iPhone produit du .mov
 * (`video/quicktime`), Android du .mp4. Les deux sont autorisés par le bucket
 * depuis la migration 20260724120000.
 *
 * @throws UploadError — toujours au stade 'upload' (pas d'étape de compression).
 */
export async function uploadPostVideo(
  uri: string,
  options?: { onProgress?: (pct: number) => void; signal?: AbortSignal }
): Promise<UploadPostVideoResult> {
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  try {
    if (signal?.aborted) throw abortedError();

    const session = await getFreshSession();

    // On conserve l'extension d'origine : renommer un .mov en .mp4 ne change
    // pas le conteneur et ferait mentir le Content-Type.
    const isQuickTime = /\.mov$/i.test(uri);
    const ext = isQuickTime ? 'mov' : 'mp4';
    const contentType = isQuickTime ? 'video/quicktime' : 'video/mp4';
    const path = `${session.user.id}/${uuidv4()}.${ext}`;

    await uploadToStorage(uri, path, BUCKET, contentType, { onProgress, signal });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) {
      logger.debug('upload_post_video_cancelled');
    } else {
      logger.error('upload_post_video_failed', uploadError);
    }
    throw uploadError;
  }
}

// ---------------------------------------------------------------------------
// Messaging upload (#210 image + #211 voice)
// ---------------------------------------------------------------------------

const MESSAGING_BUCKET = 'messaging_media';

export interface UploadMessageImageResult {
  publicUrl: string;
  path: string;
}

/**
 * Compresse + upload une image dans le bucket `messaging_media`. Pipeline
 * identique à uploadPostImage (quality 0.8, resize 1920px max). Path :
 * `{user_id}/{uuid}.jpg`.
 */
export async function uploadMessageImage(
  uri: string,
  options?: { signal?: AbortSignal; onProgress?: (p: number) => void; quality?: number }
): Promise<UploadMessageImageResult> {
  const quality = clamp01(options?.quality ?? DEFAULT_QUALITY);
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  try {
    if (signal?.aborted) throw abortedError();
    const session = await getFreshSession();
    const compressedUri = await compressImage(uri, quality);
    const path = `${session.user.id}/${uuidv4()}.jpg`;
    try {
      await uploadToStorage(compressedUri, path, MESSAGING_BUCKET, 'image/jpeg', {
        onProgress,
        signal,
      });
    } finally {
      await cleanupTempFiles([compressedUri]);
    }
    const { data } = supabase.storage.from(MESSAGING_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) logger.debug('upload_message_image_cancelled');
    else logger.error('upload_message_image_failed', uploadError);
    throw uploadError;
  }
}

export interface UploadMessageAudioResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload un fichier audio (.m4a / AAC produit par expo-audio) dans le bucket
 * `messaging_media`. Pas de compression côté client (expo-audio produit déjà
 * de l'AAC compressé). Path : `{user_id}/{uuid}.m4a`.
 */
export async function uploadMessageAudio(
  uri: string,
  options?: { signal?: AbortSignal; onProgress?: (p: number) => void }
): Promise<UploadMessageAudioResult> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  try {
    if (signal?.aborted) throw abortedError();
    const session = await getFreshSession();
    const path = `${session.user.id}/${uuidv4()}.m4a`;
    await uploadToStorage(uri, path, MESSAGING_BUCKET, 'audio/m4a', { onProgress, signal });
    const { data } = supabase.storage.from(MESSAGING_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) logger.debug('upload_message_audio_cancelled');
    else logger.error('upload_message_audio_failed', uploadError);
    throw uploadError;
  }
}

// ---------------------------------------------------------------------------
// Stories upload (E4-12)
// ---------------------------------------------------------------------------

const STORIES_BUCKET = 'stories';

export interface UploadStoryMediaResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload un média (image compressée ou vidéo mp4 brute) dans le bucket `stories`.
 * Images : même pipeline de compression que uploadPostImage.
 * Vidéos  : upload direct (expo-camera livre déjà du mp4, pas de recompression).
 */
// ---------------------------------------------------------------------------
// Marketplace upload (#245 — E7-14 — création d'annonce)
// ---------------------------------------------------------------------------

const LISTINGS_BUCKET = 'listings';

export interface UploadListingImageResult {
  publicUrl: string;
  path: string;
}

/**
 * Compresse + upload une image dans le bucket `listings`. Même pipeline que
 * uploadPostImage (quality 0.8, resize 1920px max). Path :
 * `{user_id}/{uuid}.jpg` (les policies du bucket exigent que le 1er segment
 * soit l'auth.uid()).
 */
export async function uploadListingImage(
  uri: string,
  options?: { signal?: AbortSignal; onProgress?: (p: number) => void; quality?: number }
): Promise<UploadListingImageResult> {
  const quality = clamp01(options?.quality ?? DEFAULT_QUALITY);
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  try {
    if (signal?.aborted) throw abortedError();
    const session = await getFreshSession();
    const compressedUri = await compressImage(uri, quality);
    const path = `${session.user.id}/${uuidv4()}.jpg`;
    try {
      await uploadToStorage(compressedUri, path, LISTINGS_BUCKET, 'image/jpeg', {
        onProgress,
        signal,
      });
    } finally {
      await cleanupTempFiles([compressedUri]);
    }
    const { data } = supabase.storage.from(LISTINGS_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) logger.debug('upload_listing_image_cancelled');
    else logger.error('upload_listing_image_failed', uploadError);
    throw uploadError;
  }
}

export async function uploadStoryMedia(
  uri: string,
  mediaType: 'image' | 'video',
  options?: { signal?: AbortSignal }
): Promise<UploadStoryMediaResult> {
  const signal = options?.signal;

  try {
    if (signal?.aborted) throw abortedError();

    const session = await getFreshSession();
    const ext = mediaType === 'image' ? 'jpg' : 'mp4';
    const contentType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
    const path = `${session.user.id}/${uuidv4()}.${ext}`;

    let localUri = uri;
    if (mediaType === 'image') {
      localUri = await compressImage(uri, DEFAULT_QUALITY);
    }

    try {
      await uploadToStorage(localUri, path, STORIES_BUCKET, contentType, { signal });
    } finally {
      if (mediaType === 'image') {
        await cleanupTempFiles([localUri]);
      }
    }

    const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) {
      logger.debug('upload_story_media_cancelled');
    } else {
      logger.error('upload_story_media_failed', uploadError);
    }
    throw uploadError;
  }
}

// ---------------------------------------------------------------------------
// Cours upload (#266 — E9-06 — publication d'une ressource)
// ---------------------------------------------------------------------------

const RESOURCES_BUCKET = 'resources';

export interface UploadResourceFileResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload un fichier de ressource (PDF ou image) dans le bucket `resources`.
 *
 * - Images (image/*) : compressées via le même pipeline que les posts
 *   (quality 0.8, resize 1920px) puis uploadées en JPEG.
 * - PDF (application/pdf) : uploadés tels quels, pas de compression.
 *
 * Path : `{user_id}/{uuid}.{ext}` (le 1er segment DOIT être l'auth.uid()
 * pour satisfaire les policies du bucket).
 */
export async function uploadResourceFile(
  uri: string,
  file: { mimeType?: string | null; name?: string | null },
  options?: { signal?: AbortSignal; onProgress?: (p: number) => void }
): Promise<UploadResourceFileResult> {
  const signal = options?.signal;
  const onProgress = options?.onProgress;

  const mime = (file.mimeType ?? '').toLowerCase();
  const nameExt = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(nameExt);
  const isPdf = mime === 'application/pdf' || nameExt === 'pdf';

  try {
    if (signal?.aborted) throw abortedError();
    const session = await getFreshSession();

    if (isImage) {
      const compressedUri = await compressImage(uri, DEFAULT_QUALITY);
      const path = `${session.user.id}/${uuidv4()}.jpg`;
      try {
        await uploadToStorage(compressedUri, path, RESOURCES_BUCKET, 'image/jpeg', {
          onProgress,
          signal,
        });
      } finally {
        await cleanupTempFiles([compressedUri]);
      }
      const { data } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
      return { publicUrl: data.publicUrl, path };
    }

    // PDF (ou tout ce qui n'est pas une image reconnue mais autorisé par le
    // bucket) : upload direct sans compression.
    const ext = isPdf ? 'pdf' : nameExt || 'pdf';
    const contentType = isPdf ? 'application/pdf' : (file.mimeType ?? 'application/octet-stream');
    const path = `${session.user.id}/${uuidv4()}.${ext}`;
    await uploadToStorage(uri, path, RESOURCES_BUCKET, contentType, { onProgress, signal });
    const { data } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    const uploadError = error instanceof UploadError ? error : new UploadError('upload', error);
    if (signal?.aborted) logger.debug('upload_resource_file_cancelled');
    else logger.error('upload_resource_file_failed', uploadError);
    throw uploadError;
  }
}
