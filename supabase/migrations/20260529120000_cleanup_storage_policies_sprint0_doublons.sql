-- Cleanup — suppression des doublons Sprint 0 sur storage.objects
--
-- Contexte : en Sprint 0 (avant le repo), des policies ont été créées via la
-- console Supabase pour les buckets `posts` et `stories`. En Sprint 3 et
-- Sprint 4, on a re-déclaré ces policies dans des migrations versionnées avec
-- des noms différents et un scoping plus strict (rôle `authenticated` au lieu
-- de `public`, contrôle de dossier `(storage.foldername(name))[1] = auth.uid()`).
--
-- Les deux jeux de policies coexistent depuis. Comme RLS est PERMISSIVE
-- (union des policies), les anciennes laxistes Sprint 0 prennent quand même
-- effet et masquent en partie le durcissement opéré par les nouvelles. On
-- supprime ici les anciennes pour ne garder que les versions Sprint 3/4 du
-- repo.
--
-- Vérifié avant exécution :
--   - Le code mobile upload via createUploadTask dans `${userId}/${uuid}.ext`
--     (src/lib/storage.ts:349 pour posts, l.404 pour stories) → pattern
--     compatible avec les policies Sprint 3/4 qui valident
--     `(storage.foldername(name))[1] = auth.uid()::text`.
--   - Audit DEV du 2026-05-29 : 4 doublons sur `posts`, 3 doublons sur
--     `stories`. Les buckets `avatars`, `covers`, `listings_media`,
--     `messaging_media`, `ai_attachments` n'ont pas de doublons — non touchés.
--
-- À appliquer DEV puis STAGING via AI Supabase. Idempotent
-- (`drop policy if exists`) donc safe à re-rejouer.

-- ----- posts (4 policies Sprint 0) -----
drop policy if exists "posts_insert_own"   on storage.objects;
drop policy if exists "posts_update_own"   on storage.objects;
drop policy if exists "posts_delete_own"   on storage.objects;
drop policy if exists "posts_read_object"  on storage.objects;

-- ----- stories (3 policies Sprint 0) -----
drop policy if exists "stories_insert_own"  on storage.objects;
drop policy if exists "stories_delete_own"  on storage.objects;
drop policy if exists "stories_read_object" on storage.objects;

-- Post-condition attendue après application (à vérifier manuellement) :
--   select policyname, cmd, roles from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and (policyname ilike '%posts%' or policyname ilike '%stories%')
--   order by policyname;
--
-- Doit retourner exactement 7 policies (4 posts + 3 stories), toutes sur le
-- rôle `authenticated` (sauf les deux "public read" qui sont sur
-- {anon, authenticated}).
