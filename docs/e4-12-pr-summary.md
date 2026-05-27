# PR Summary — E4-12 : Stories, capture photo/vidéo + upload

> Branche : `feature/E4-12-stories-capture` → `dev`  
> Closes #52

---

## Ce qui a été livré

### 1. Migration BDD — bucket Storage `stories`

**Fichier :** `supabase/migrations/20260526120000_stories_storage_bucket.sql`

Le bucket `stories` n'était pas tracé dans les migrations existantes (Sprint 0 l'avait créé manuellement sans l'écrire). Cette migration le (re)crée de façon **idempotente** via `ON CONFLICT DO UPDATE`, ce qui évite tout conflit si le bucket existe déjà sur dev ou staging.

Paramètres du bucket :

- Public : `true` (les URLs sont publiques, la protection est faite par RLS sur la table `stories`)
- `file_size_limit` : 100 Mo (suffisant pour une vidéo MP4 de 15 s en qualité native)
- `allowed_mime_types` : `image/jpeg`, `image/png`, `image/webp`, `video/mp4`

Trois policies RLS Storage (pattern identique à `posts`) :

- `stories users upload own folder` : un user authentifié ne peut écrire que dans son dossier `{auth.uid()}/`
- `stories users delete own folder` : idem pour la suppression
- `stories public read` : lecture publique anonyme + authentifiée

---

### 2. `src/lib/storage.ts` — `uploadStoryMedia` + refactoring minimal

**Changements :**

`runUploadAttempt` et `uploadToStorage` acceptent maintenant `contentType: string` et `bucket: string` en paramètre au lieu de valeurs hardcodées. Cela évite la duplication de la logique retry/backoff pour le bucket `stories`.

Rétrocompatibilité de `uploadPostImage` assurée : on passe `BUCKET` et `'image/jpeg'` au call site, le comportement externe est identique.

Nouvelle fonction publique `uploadStoryMedia(uri, mediaType, options?)` :

| `mediaType` | Traitement                                                                                                      | Content-Type | Extension |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| `'image'`   | Compression JPEG identique à `uploadPostImage` (≤ 1920 px, ≤ 500 Ko, fallback qualité 0.6 / 0.4) + cleanup temp | `image/jpeg` | `.jpg`    |
| `'video'`   | Upload direct (expo-camera livre déjà du MP4, pas de recompression)                                             | `video/mp4`  | `.mp4`    |

Le path dans Storage suit le pattern `{user_id}/{uuid}.ext` (même convention que `posts`).

---

### 3. `src/features/stories/hooks/useCreateStory.ts`

Hook TanStack Query `useMutation<void, Error, CreateStoryInput>`.

```ts
interface CreateStoryInput {
  uri: string;
  mediaType: 'image' | 'video'; // 'image' correspond au CHECK BDD ('image', 'video')
  durationSeconds?: number;
}
```

`mutationFn` :

1. `uploadStoryMedia(uri, mediaType)` → `publicUrl`
2. `supabase.from('stories').insert({ media_url, media_type, duration_seconds })`
   - `author_id` : non envoyé → default `auth.uid()` côté BDD
   - `expires_at` : non envoyé → default `now() + interval '24 hours'` côté BDD

`onSuccess` invalide **deux** query keys :

- `['stories', 'feed']` → visionneuse E4-13 (consomme la RPC `get_stories_feed`)
- `['feed', 'stories']` → barre stories du feed (`useFeedStories`, query key existante)

> **Landmine corrigée pendant l'audit :** la version initiale n'invalidait que `['stories', 'feed']`. La barre stories du feed ne se serait jamais rafraîchie après publication (staletime 60 s).

`onError` : `logger.error('create_story_failed', error)` → route vers Sentry en prod.

---

### 4. `src/features/stories/screens/CreateStoryScreen.tsx`

Machine à états à deux phases : `camera` (capturedAsset === null) et `preview` (capturedAsset !== null).

#### Phase `camera`

**Permissions :**  
`useCameraPermissions` + `useMicrophonePermissions` demandées au mount via `useEffect`. Pendant le chargement initial (permission === null) : écran noir opaque pour éviter le flash. Si caméra refusée : message + bouton Retour.

**Modes Photo / Vidéo :**  
Toggle en header avec fond vert sur le mode actif. L'état `mode: 'image' | 'video'` contrôle :

- La prop `mode` de `CameraView` (`'picture'` | `'video'`)
- Le comportement du bouton de capture
- Le filtre du picker galerie

**Bouton de capture (Pressable) :**

| Action                   | Mode Photo           | Mode Vidéo                         |
| ------------------------ | -------------------- | ---------------------------------- |
| `onPress`                | `takePictureAsync()` | rien                               |
| `onLongPress` (≥ 200 ms) | rien                 | `recordAsync({ maxDuration: 15 })` |
| `onPressOut`             | rien                 | `stopRecording()` si `isRecording` |

**Timer d'enregistrement :**  
Un `setInterval` à 500 ms incrémente `timerSecs`. Le timer s'auto-arrête quand `elapsed >= 15`. Cleanup dans `useEffect` de démontage + dans le `beforeRemove` listener.

**Galerie :**  
`expo-image-picker.launchImageLibraryAsync` avec `mediaTypes` filtré selon le mode courant, `videoMaxDuration: 15`.

**Flip :** toggle `facing` entre `'back'` et `'front'`.

#### Phase `preview`

- **Image** : `<Image>` expo-image plein écran, `contentFit="cover"`
- **Vidéo** : `<VideoView>` expo-video, `nativeControls={false}`, autoplay + loop (via `useVideoPlayer`)  
  Le player reçoit `null` tant qu'on est en phase camera (évite la création d'un player inutile).  
  Un `useEffect` sur `capturedAsset` appelle `videoPlayer.play()` à l'entrée en preview vidéo.

**Boutons :**

- **Recommencer** : `setCapturedAsset(null)` + `createStory.reset()` → retour phase camera
- **Publier** : `createStory.mutate(...)` → `router.back()` on success, overlay bloquant pendant `isPending`

**Gestion d'erreur :**

- Erreur de publication : bandeau rouge en overlay avec le message de l'erreur.
- Erreur d'enregistrement vidéo (exception dans `recordAsync`) : Alert + `logger.error` → Sentry. Le `try/catch` de `handleStartRecording` distingue stop normal (résolution de la promesse) d'une vraie exception (qui throw).

> **Landmine corrigée :** le catch initial avait un commentaire erroné ("arrêt normal via stopRecording") — or `stopRecording()` résout la promesse, pas la rejette. Toute exception dans `recordAsync` est donc un vrai problème (ex. permission micro refusée au niveau OS). Maintenant correctement loggée + alertée.

**Cleanup navigation :**  
`navigation.addListener('beforeRemove')` avec `[navigation, isRecording]` en deps : si l'utilisateur ferme la modale en cours d'enregistrement, `stopRecording()` est appelé pour éviter un upload zombie.

---

### 5. `app/story/create.tsx`

Route mince qui configure la présentation (`fullScreenModal`) et délègue au composant écran. Pattern identique à `app/post/create.tsx`.

---

## Bugs détectés et corrigés lors de l'audit

| #   | Sévérité     | Description                                                                                                                                                                          | Fix                              |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | **Critique** | `useCreateStory` n'invalidait que `['stories', 'feed']`. La barre stories (`useFeedStories`, key `['feed', 'stories']`) ne se rafraîchissait jamais.                                 | Ajout de la seconde invalidation |
| 2   | **Moyen**    | `handleStartRecording` swallowait silencieusement toutes les exceptions (commentaire erroné : stopRecording résout, pas reject). Erreur micro permission → aucun retour utilisateur. | Catch → Alert + logger.error     |
| 3   | **Faible**   | Import `logger` manquant dans `CreateStoryScreen` (introduit par le fix #2).                                                                                                         | Import ajouté                    |

---

## Points hors scope (confirmés par le ticket)

- Stickers, texte, musique de fond sur la story
- Multi-segment (une seule story par capture)
- Progress bar d'upload (pas de callback `onProgress` exposé dans `uploadStoryMedia` — ajout possible si besoin)
- Thumbnail vidéo (colonne `thumbnail_url` dans `get_stories_feed` RPC — sera alimentée côté visionneuse E4-13)

---

## Dépendance bloquante créée

**E4-13 Visionneuse** : peut désormais démarrer. Des stories valides sont insérables en BDD via cet écran. La RPC `get_stories_feed` et la query key `['stories', 'feed']` sont prêtes à être consommées.

---

## Checklist CI

- [x] `pnpm typecheck` → 0 erreur
- [x] `pnpm lint` → 0 warning / error
- [x] Migration idempotente (safe sur dev, staging, prod)
- [x] Pas de `author_id` / `expires_at` envoyés côté client
- [x] Pas de clé API dans le code client
- [x] RLS validée (policy upload restreint au dossier `auth.uid()`)
