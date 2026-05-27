# Plan de test — E4-12 Stories : capture photo/vidéo

> Branche : `feature/E4-12-stories-capture`  
> Prérequis : Dev Build mis à jour (expo-camera, expo-video, expo-notifications inclus), `.env.local` valide, compte de test connecté.

---

## T-01 — Permissions caméra refusées

**Étapes :**

1. Dans les Réglages du téléphone, révoquer l'accès caméra à l'app DOUMASSI.
2. Ouvrir la modale de création story (ex. tap sur le « + » stories dans le feed).

**Attendu :**

- Écran noir avec message _"Activez l'accès à la caméra dans les Réglages pour utiliser les stories."_
- Bouton **Retour** visible et fonctionnel (ferme la modale).
- Pas de crash.

---

## T-02 — Toggle Photo / Vidéo (état par défaut)

**Étapes :**

1. Ouvrir la modale de création story (permissions accordées).

**Attendu :**

- Mode **Photo** actif par défaut (fond vert #10D970 sur le bouton Photo).
- Bouton Photo affiche l'icône caméra au centre du bouton de capture.
- Bouton Vidéo affiche un cercle rouge au centre (indique mode vidéo disponible).
- Switch Photo → Vidéo → Photo fonctionne sans freeze ni re-mount visible.

---

## T-03 — Capture photo (tap)

**Étapes :**

1. Mode Photo actif.
2. Taper une fois sur le bouton de capture central.

**Attendu :**

- Vue caméra remplacée immédiatement par la preview de la photo (plein écran, `contentFit="cover"`).
- Deux boutons visibles en bas : **Recommencer** et **Publier**.
- Aucun timer affiché.

---

## T-04 — Capture vidéo (appui long) + timer

**Étapes :**

1. Passer en mode Vidéo.
2. Appuyer longuement (≥ 200 ms) sur le bouton de capture.
3. Maintenir 5 secondes puis relâcher.

**Attendu :**

- Badge rouge `⏺ 0:00` apparaît en haut dès le début de l'enregistrement.
- Timer incrémente toutes les demi-secondes jusqu'à `0:05`.
- À relâchement : timer disparaît, preview vidéo s'affiche (lecture auto + loop).
- `durationSeconds ≈ 5` (vérifié côté BDD après publication).

---

## T-05 — Auto-stop vidéo à 15 s

**Étapes :**

1. Mode Vidéo — maintenir le bouton enfoncé jusqu'à auto-arrêt.

**Attendu :**

- Timer monte de `0:00` jusqu'à `0:15` puis s'arrête.
- L'enregistrement s'arrête automatiquement (sans relâcher).
- Preview vidéo s'affiche, durée ≈ 15 s.

---

## T-06 — Galerie — sélection image

**Étapes :**

1. Mode Photo actif.
2. Tap sur l'icône galerie (bas gauche).
3. Sélectionner une image depuis la photothèque.

**Attendu :**

- Picker s'ouvre en mode "images seulement".
- Preview photo affichée après sélection.
- Si permission refusée : Alert "Activez l'accès aux photos dans les Réglages."

---

## T-07 — Galerie — sélection vidéo (≤ 15 s)

**Étapes :**

1. Mode Vidéo actif.
2. Tap sur l'icône galerie.
3. Sélectionner une vidéo courte (< 15 s) puis une longue (> 15 s).

**Attendu :**

- Picker s'ouvre en mode "vidéos seulement", durée max 15 s.
- Vidéo courte : preview en autoplay + loop.
- Vidéo longue : le picker lui-même devrait la refuser (géré par `videoMaxDuration`).

---

## T-08 — Bouton flip

**Étapes :**

1. Tap sur l'icône flip (haut droite).

**Attendu :**

- Caméra bascule entre avant (front) et arrière (back).
- Le flip fonctionne dans les deux modes Photo et Vidéo.

---

## T-09 — Bouton Recommencer

**Étapes :**

1. Prendre une photo (T-03) pour entrer en état preview.
2. Appuyer sur **Recommencer**.

**Attendu :**

- La vue caméra reprend (même mode qu'avant la capture).
- L'état d'erreur éventuel est réinitialisé.

---

## T-10 — Publication image (golden path)

**Étapes :**

1. Prendre une photo.
2. Appuyer sur **Publier**.

**Attendu :**

- Loader `ActivityIndicator` visible sur le bouton Publier pendant l'upload.
- Overlay semi-transparent bloque les interactions.
- Après succès : modale fermée (`router.back()`).
- Dans Supabase Studio → table `stories` : nouvelle ligne avec
  - `media_url` : URL publique dans le bucket `stories`
  - `media_type = 'image'`
  - `duration_seconds = null`
  - `expires_at ≈ now() + 24h`
  - `author_id` = UUID de l'utilisateur connecté
- Dans Supabase Studio → Storage bucket `stories` : fichier `{user_id}/{uuid}.jpg` présent.
- La barre stories dans le feed se rafraîchit (query `['feed', 'stories']` invalidée).

---

## T-11 — Publication vidéo (golden path)

**Étapes :**

1. Enregistrer une vidéo ~5 s.
2. Appuyer sur **Publier**.

**Attendu :**

- Idem T-10 pour le flux UI.
- Dans Supabase Studio → table `stories` :
  - `media_type = 'video'`
  - `duration_seconds ≈ 5`
  - `media_url` → fichier `.mp4` dans le bucket `stories`
- Fichier `.mp4` accessible en public (URL directement jouable).

---

## T-12 — Erreur réseau pendant l'upload

**Étapes :**

1. Prendre une photo.
2. Couper le WiFi / data.
3. Appuyer sur **Publier**.

**Attendu :**

- Trois tentatives de retry (backoff 1 s / 2 s / 4 s) puis échec.
- Bandeau d'erreur rouge visible avec le message d'erreur.
- Bouton Publier redevient accessible (pas de blocage infini).
- Aucun INSERT dans `stories` (upload a échoué avant).

---

## T-13 — Invalidation des deux caches feed

**Étapes :**

1. Ouvrir le feed (barre stories visible).
2. Publier une story (T-10).
3. Revenir au feed sans forcer un refresh manuel.

**Attendu :**

- La barre stories se met à jour automatiquement (`['feed', 'stories']` invalidé).
- Si l'écran visionneuse E4-13 est intégré, il se rafraîchit aussi (`['stories', 'feed']`).

---

## T-14 — Fermeture mid-recording

**Étapes :**

1. Démarrer un enregistrement vidéo (appui long).
2. Pendant l'enregistrement, swipe-down pour fermer la modale.

**Attendu :**

- `stopRecording()` appelé → pas d'upload zombie.
- Aucun crash, aucune story insérée en BDD.
- Timer nettoyé (pas de `setInterval` zombie).

---

## T-15 — RLS : upload dans le bon dossier Storage

**Contexte :** la policy RLS exige `(storage.foldername(name))[1] = auth.uid()::text`.

**Étapes :**

1. Publier une story avec le compte `user_A`.
2. Via l'API Supabase (anon key), tenter d'uploader un fichier sous le path `user_B/{uuid}.jpg`.

**Attendu :**

- L'upload sous le path `user_A/…` réussit.
- L'upload sous `user_B/…` retourne HTTP 403 (politique RLS refusée).

---

## Checklist rapide pré-PR

- [ ] Typecheck : `pnpm typecheck` → 0 erreur
- [ ] Lint : `pnpm lint` → 0 warning/error
- [ ] Migration `20260526120000_stories_storage_bucket.sql` appliquée sur **dev**
- [ ] T-03, T-04, T-10, T-11 passent sur device physique
- [ ] T-13 vérifié : barre stories rafraîchie sans reload manuel
- [ ] Pas de `console.log` ajouté (vérifier git diff)
