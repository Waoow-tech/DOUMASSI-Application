-- Sprint 6 — Ticket #213 : mentions @username
--
-- 1/2 : ajout de la valeur 'mention' à l'enum notification_type.
--
-- PostgreSQL ne permet pas d'utiliser une nouvelle valeur d'enum dans la MÊME
-- transaction que son ajout (ALTER TYPE ... ADD VALUE). On splitte donc en 2
-- migrations :
--   - 20260624140000 (ici) : ajout 'mention' à l'enum, isolé.
--   - 20260624140100      : helper + trigger qui peut référencer 'mention'.
--
-- Idempotent : `add value if not exists`. Sûr de re-rejouer sur DEV/STAGING.
--
-- À appliquer DEV + STAGING via AI Supabase.

alter type public.notification_type add value if not exists 'mention';
