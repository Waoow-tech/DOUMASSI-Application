-- E4-14 — Préreq de l'infra push notifications.
--
-- L'extension pg_net est utilisée par le trigger fn_trigger_push_notification
-- (cf. 20260526120000_trigger_push_on_notification_insert.sql) pour appeler
-- l'Edge Function `send-push` via net.http_post.
--
-- Sans cette extension, l'INSERT dans `notifications` échoue avec
-- « schema 'net' does not exist » dès le premier appel au trigger
-- (PostgreSQL ne valide les références à la compilation pour les fonctions
-- plpgsql, donc le CREATE FUNCTION passe mais l'exécution plante).
--
-- Le schéma `extensions` est le pattern Supabase standard (cohérent avec
-- le `set search_path = public, extensions` du trigger).
--
-- Appliquée via AI Supabase sur dev + staging le 26 mai 2026
-- (migration enable_pg_net).

create extension if not exists pg_net with schema extensions;