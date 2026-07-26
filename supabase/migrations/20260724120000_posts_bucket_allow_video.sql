-- E14-01 — Autoriser la vidéo dans les posts.
--
-- La base acceptait déjà `posts.media_type = 'video'` depuis le Sprint 3
-- (cf. 20260517100001_extend_posts_for_feed.sql), et PostCard sait déjà
-- afficher la pastille Play. Le seul verrou côté serveur était le bucket :
-- il n'acceptait que des images et plafonnait à 10 Mo.
--
-- Alignement sur le bucket `stories`, qui accepte la vidéo depuis le Sprint 4 :
--   - ajout de video/mp4 et video/quicktime (l'iPhone produit du .mov)
--   - plafond porté à 100 Mo
--
-- ⚠️ Le plafond de 100 Mo est une limite de SÉCURITÉ, pas la limite produit.
-- La vraie limite est la durée (60 s), imposée côté client. Les deux sont
-- volontairement décorrélées : une limite d'octets seule laisserait passer une
-- vidéo de 10 minutes très compressée.
--
-- Aucune policy touchée : celles du bucket `posts` sont déjà scopées par
-- dossier utilisateur et ne dépendent pas du type MIME.
--
-- Idempotent (on conflict do update).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  true,
  104857600, -- 100 Mo max (vidéos ≤ 60 s)
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   select file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'posts';
--   -- => 104857600, {image/jpeg,image/png,image/webp,video/mp4,video/quicktime}
-- ---------------------------------------------------------------------------
