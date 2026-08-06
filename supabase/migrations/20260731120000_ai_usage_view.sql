-- E1-15 — Vue de consultation de l'usage IA (base du monitoring des coûts).
--
-- Depuis le câblage de la capture des tokens (fonction ai-chat), chaque message
-- assistant porte tokens_input / tokens_output / model_used. Cette vue les
-- agrège par JOUR et par MODÈLE, pour répondre aux questions « combien de
-- tokens par jour ? par modèle ? ».
--
-- ⚠️ On ne calcule PAS le coût en $ ici : le tarif dépend du fournisseur/modèle
-- (Groq, cf. ADR-009) et change régulièrement. Mettre un tarif en dur dans une
-- migration vieillirait mal. Le coût se calcule à la lecture (voir la requête
-- d'exemple en bas), avec le tarif du moment — ou dans le dashboard PostHog.
--
-- Comme moderation_queue : consultable via le dashboard (service_role), pas
-- exposée aux clients.
--
-- Idempotent.

create or replace view public.ai_usage_daily as
  select
    (m.created_at at time zone 'UTC')::date as day,
    coalesce(m.model_used, 'unknown')        as model,
    count(*)                                 as messages,
    coalesce(sum(m.tokens_input), 0)         as tokens_input,
    coalesce(sum(m.tokens_output), 0)        as tokens_output,
    coalesce(sum(m.tokens_input + m.tokens_output), 0) as tokens_total
  from public.ai_messages m
  where m.role = 'assistant'
  group by 1, 2
  order by 1 desc, 6 desc;

comment on view public.ai_usage_daily is
  'E1-15 — usage IA agrégé par jour/modèle (tokens). Coût $ calculé à la lecture. '
  'Dashboard/service_role uniquement.';

revoke all on public.ai_usage_daily from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utilisation (dashboard SQL editor) :
--
--   -- Tokens par jour et par modèle
--   select * from public.ai_usage_daily;
--
--   -- Estimation de coût sur 7 jours (⚠️ ADAPTER les tarifs Groq du moment,
--   --    en $ par MILLION de tokens — exemple avec des valeurs indicatives) :
--   select day, model, tokens_input, tokens_output,
--     round((tokens_input  / 1e6 * 0.6)        -- $/M input   (à ajuster)
--         + (tokens_output / 1e6 * 0.8), 4)    -- $/M output  (à ajuster)
--       as est_cost_usd
--   from public.ai_usage_daily
--   where day >= current_date - 7
--   order by day desc;
-- ---------------------------------------------------------------------------
