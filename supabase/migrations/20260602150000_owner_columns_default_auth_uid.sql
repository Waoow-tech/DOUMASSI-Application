-- Fix consolidé : DEFAULT auth.uid() manquant sur 8 colonnes owner
--
-- Audit complet réalisé par le CTO le 2026-06-02 18:00 après découverte du
-- bug `stories.author_id` (qui avait son propre fix juste avant —
-- 20260602140000_stories_author_id_default.sql). L'audit a croisé pour chaque
-- table `public.*` les colonnes owner (author_id, user_id, sender_id, etc.)
-- avec leurs policies RLS INSERT.
--
-- Pattern du bug :
--   - Une policy INSERT a `with check (col = auth.uid())` pour empêcher
--     l'usurpation côté client (sécurité OK)
--   - Mais la colonne n'a pas `default auth.uid()` côté schéma
--   - Le client (par discipline RGPD/sécurité) n'envoie pas la colonne
--   - Postgres insère NULL → la policy évalue `NULL = auth.uid()` → NULL →
--     INSERT rejeté avec « new row violates row-level security policy »
--
-- Le fix : on ajoute le DEFAULT auth.uid() sur les 8 colonnes identifiées.
-- Les autres colonnes nullable (recipient_id, followed_id, created_by,
-- conversation_participants.user_id, ai_rate_limits.user_id, etc.) sont
-- volontairement NON modifiées — soit elles désignent un autre user (followed,
-- recipient), soit elles sont uniquement remplies via RPC SECURITY DEFINER
-- ou trigger côté serveur.
--
-- À appliquer DEV + STAGING via AI Supabase.

alter table public.blocks            alter column blocker_id  set default auth.uid();
alter table public.comment_likes     alter column user_id     set default auth.uid();
alter table public.comments          alter column author_id   set default auth.uid();
alter table public.follows           alter column follower_id set default auth.uid();
alter table public.listing_bookmarks alter column user_id     set default auth.uid();
alter table public.messages          alter column sender_id   set default auth.uid();
alter table public.deletion_requests alter column user_id     set default auth.uid();
alter table public.ai_conversations  alter column user_id     set default auth.uid();

-- Vérification post-application :
--   select table_name, column_name, column_default
--   from information_schema.columns
--   where table_schema = 'public' and column_default like '%auth.uid()%'
--   order by table_name;
-- Attendu : 12 lignes (4 déjà fixées au Sprint 3 + 8 ajoutées ici)
