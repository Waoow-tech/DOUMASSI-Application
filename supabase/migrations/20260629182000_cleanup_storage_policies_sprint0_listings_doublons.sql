-- Cleanup — suppression des doublons Sprint 0 sur storage.objects (bucket listings)
--
-- Contexte : 3e occurrence du même pattern qu'on a déjà traité pour `posts` et
-- `stories` dans la migration 20260529120000. En Sprint 0 (avant le repo), 4
-- policies ont été créées via la console Supabase pour le bucket `listings`
-- avec des noms snake_case et un scoping sur le rôle `public` (laxiste). En
-- Sprint 7, on a re-déclaré ces policies dans la migration versionnée
-- 20260629181000_listings_storage_bucket.sql avec :
--   - Noms format "phrase" pour cohérence avec les versions Sprint 3+
--     (`listings users upload own folder`, `listings public read`, etc.)
--   - Scoping sur `authenticated` (sauf public read sur `anon, authenticated`)
--   - Contrôle de dossier `(storage.foldername(name))[1] = auth.uid()::text`
--
-- Les deux jeux coexistent depuis l'application de la migration
-- 20260629181000. Comme RLS est PERMISSIVE (union des policies), les
-- anciennes laxistes Sprint 0 prennent quand même effet et masquent en partie
-- le durcissement opéré par les nouvelles. On supprime ici les anciennes pour
-- ne garder que les versions Sprint 7 du repo.
--
-- Vérifié avant exécution :
--   - 4 doublons constatés sur DEV (vérif via SELECT pg_policies du 2026-06-29) :
--     `listings_read_object`, `listings_insert_own`, `listings_update_own`,
--     `listings_delete_own`. Toutes en rôle {public}, sans contrôle de dossier
--     auth.uid().
--   - Le code mobile (à venir avec E7-14) uploadera via createUploadTask dans
--     `${userId}/${uuid}.ext` — pattern compatible avec les policies Sprint 7.
--
-- À appliquer DEV puis STAGING via AI Supabase, **après** la migration
-- 20260629181000_listings_storage_bucket.sql. Idempotent (`drop policy if
-- exists`) donc safe à re-rejouer.

-- ----- listings (4 policies Sprint 0) -----
drop policy if exists "listings_insert_own"  on storage.objects;
drop policy if exists "listings_update_own"  on storage.objects;
drop policy if exists "listings_delete_own"  on storage.objects;
drop policy if exists "listings_read_object" on storage.objects;

-- Post-condition attendue après application (à vérifier manuellement) :
--   select policyname, cmd, roles from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and policyname ilike '%listings%'
--   order by policyname;
--
-- Doit retourner exactement 4 policies, toutes au format "phrase" :
--   - listings users upload own folder       (INSERT, authenticated)
--   - listings users update own folder       (UPDATE, authenticated)
--   - listings users delete own folder       (DELETE, authenticated)
--   - listings public read                   (SELECT, {anon, authenticated})
