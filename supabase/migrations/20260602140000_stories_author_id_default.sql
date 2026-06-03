-- Fix : DEFAULT auth.uid() manquant sur stories.author_id
--
-- Même bug que sur posts.author_id (corrigé en Sprint 3 par
-- 20260520120000_posts_author_id_default.sql). La table stories a été
-- déployée au Sprint 0 sans DEFAULT sur author_id.
--
-- useCreateStory (E4-12) insère volontairement sans author_id (pattern
-- RGPD : la base est seule source de vérité pour cette colonne, le client
-- ne doit jamais pouvoir l'usurper). Sans le DEFAULT, la colonne tombe
-- à NULL, et la policy RLS "stories users insert own" évalue
-- `author_id = auth.uid()` comme NULL → INSERT rejeté avec
-- « new row violates row-level security policy for table stories ».
--
-- Bug remonté par le CTO en test du Dev Build (2026-06-02 17:48).
--
-- À appliquer DEV + STAGING via AI Supabase.

alter table public.stories alter column author_id set default auth.uid();

-- Vérification post-application : la colonne doit avoir le default
-- select column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'stories' and column_name = 'author_id';
-- attendu : "auth.uid()"
