-- Fix de dépendance — table app_config
--
-- CONTEXTE : `app_config` (clé → valeur entière, pour des seuils ajustables sans
-- migration) n'était créée QUE par 20260702160000_cours_resource_reports.sql.
-- E13-07 (signalement de la mise en relation) la référence aussi.
--
-- Or elle s'est révélée ABSENTE de dev et staging à l'application de E13-07 :
-- la migration E9 qui la crée n'y avait donc jamais été jouée. Faire dépendre
-- une migration d'une autre, sans rapport fonctionnel, est fragile.
--
-- Ce fichier la crée donc de façon AUTONOME et idempotente, avec un timestamp
-- antérieur à E13-07. Sur une base fraîche, la migration E9 (plus ancienne) la
-- crée déjà : le `if not exists` rend ce fichier inoffensif.
--
-- ⚠️ Ce fichier ne règle QUE la dépendance de E13-07. Si la migration E9
-- n'a jamais été appliquée, alors `resource_reports` et `report_resource`
-- manquent aussi → le signalement des ressources Cours (E9-08) est inopérant.
-- À vérifier séparément (requête de diagnostic en fin de fichier).
--
-- Idempotent.

create table if not exists public.app_config (
  key        text primary key,
  int_value  int,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Seuils applicatifs ajustables sans migration (signalements, rate limits).';

-- RLS : table de configuration serveur, jamais lue par le client.
alter table public.app_config enable row level security;
-- Aucune policy : accès réservé aux fonctions security definer.

-- ---------------------------------------------------------------------------
-- DIAGNOSTIC à exécuter sur dev/staging — la migration E9 a-t-elle été jouée ?
--
--   select
--     to_regclass('public.app_config')             as app_config,
--     to_regclass('public.resource_reports')       as resource_reports,
--     to_regproc('public.report_resource')         as fn_report_resource;
--
-- Si `resource_reports` ou `report_resource` sont NULL, la migration
-- 20260702160000_cours_resource_reports.sql n'a pas été appliquée → il faut la
-- rejouer (elle est idempotente).
-- ---------------------------------------------------------------------------
