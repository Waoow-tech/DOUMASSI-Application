-- Sécu B3 (léger) — File de modération consolidée.
--
-- PARTI PRIS : PAS d'écran admin dans l'app pour l'instant. Un système de rôle
-- admin + une UI de modération sont une décision produit (qui est admin ?
-- in-app ou outil séparé ?) et seraient sur-dimensionnés pour une bêta fermée.
--
-- Ce qu'on fait à la place : une VUE qui unifie les 3 types de signalements
-- (profils, ressources Cours, intentions de mise en relation) en une seule file.
-- Le CTO peut la consulter depuis le SQL editor du dashboard (service_role
-- contourne la RLS) ; un utilisateur normal, lui, ne voit RIEN (les tables
-- sous-jacentes ont la RLS activée sans policy de lecture — la vue en hérite).
--
-- C'est aussi la fondation data d'un futur écran de modération, si on décide
-- d'en construire un post-bêta.
--
-- Idempotent.

create or replace view public.moderation_queue as
  select
    'profile'::text            as report_type,
    r.id                       as report_id,
    r.reported_user_id         as target_id,
    r.reporter_id,
    r.reason,
    r.created_at
  from public.profile_reports r
  union all
  select
    'resource'::text,
    r.id,
    r.resource_id,
    r.reporter_id,
    r.reason,
    r.created_at
  from public.resource_reports r
  union all
  select
    'matching'::text,
    r.id,
    r.intent_id,
    r.reporter_id,
    r.reason,
    r.created_at
  from public.matching_intent_reports r;

comment on view public.moderation_queue is
  'Sécu B3 — file de modération consolidée (profils + ressources + intentions). '
  'À consulter via le dashboard (service_role). Invisible pour les users (RLS des tables sous-jacentes).';

-- On NE donne PAS d'accès à anon/authenticated : seul service_role (dashboard,
-- Edge Functions) lit cette vue. Un futur écran admin passerait par une RPC
-- security definer gardée par un vrai check de rôle.
revoke all on public.moderation_queue from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utilisation (dashboard SQL editor) :
--
--   -- Tous les signalements, plus récents d'abord
--   select * from public.moderation_queue order by created_at desc;
--
--   -- Les cibles les plus signalées (à regarder en priorité)
--   select report_type, target_id, count(*) as nb
--   from public.moderation_queue
--   group by report_type, target_id
--   having count(*) >= 2
--   order by nb desc;
-- ---------------------------------------------------------------------------
