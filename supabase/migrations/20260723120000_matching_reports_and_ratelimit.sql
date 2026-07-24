-- E13-07 (#357) — Mise en relation : signalement + anti-abus
--
-- Voir ADR-008 §2.7. Dernier morceau de l'épic E13.
--
-- Deux protections distinctes :
--   1. SIGNALEMENT d'une intention (contenu inapproprié, spam…), avec
--      désactivation automatique au seuil — même patron que report_resource
--      (E9), y compris le seuil configurable via app_config.
--   2. LIMITE DE DÉBIT sur les demandes de mise en relation, pour éviter qu'un
--      compte arrose toute la base.
--
-- Indispensable dès lors que l'app accueille des 15-17 ans : sans signalement,
-- un contenu problématique reste visible jusqu'à intervention manuelle.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Seuils configurables (mêmes conventions que resource_report_threshold)
-- ---------------------------------------------------------------------------

insert into public.app_config (key, int_value) values
  -- Nombre de signalements distincts avant désactivation auto d'une intention.
  ('matching_intent_report_threshold', 3),
  -- Demandes de mise en relation autorisées par heure et par utilisateur.
  ('matching_requests_per_hour', 30)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 1) Signalement d'une intention
-- ---------------------------------------------------------------------------

create table if not exists public.matching_intent_reports (
  id          uuid primary key default gen_random_uuid(),
  intent_id   uuid not null references public.matching_intents(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('inapproprie', 'spam', 'faux_profil', 'autre')),
  created_at  timestamptz not null default now(),
  unique (intent_id, reporter_id)   -- 1 signalement max par user et par intention
);

comment on table public.matching_intent_reports is
  'E13-07 — signalements d''intentions de mise en relation. Désactivation auto au seuil (app_config).';

create index if not exists idx_matching_intent_reports_intent
  on public.matching_intent_reports (intent_id);

alter table public.matching_intent_reports enable row level security;
-- Aucune policy : la table n'est accessible que via la RPC (security definer).
-- Un utilisateur n'a aucune raison de lire les signalements, pas même les siens.

create or replace function public.report_matching_intent(p_intent_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_owner     uuid;
  v_threshold int;
  v_count     int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason not in ('inapproprie', 'spam', 'faux_profil', 'autre') then
    raise exception 'Motif de signalement invalide';
  end if;

  select user_id into v_owner from public.matching_intents where id = p_intent_id;
  if v_owner is null then
    raise exception 'Intention introuvable';
  end if;
  if v_owner = v_user then
    raise exception 'Impossible de signaler sa propre intention';
  end if;

  -- Rejouer un signalement déjà fait est sans effet (pas d'erreur : l'UI ne doit
  -- pas révéler si l'utilisateur avait déjà signalé).
  insert into public.matching_intent_reports (intent_id, reporter_id, reason)
  values (p_intent_id, v_user, p_reason)
  on conflict (intent_id, reporter_id) do nothing;

  select int_value into v_threshold
  from public.app_config where key = 'matching_intent_report_threshold';

  select count(*) into v_count
  from public.matching_intent_reports where intent_id = p_intent_id;

  -- Désactivation automatique au seuil : l'intention disparaît de la découverte
  -- (get_matching_candidates filtre sur is_active) sans être supprimée, pour
  -- garder la trace en cas de contestation.
  if v_threshold is not null and v_count >= v_threshold then
    update public.matching_intents
       set is_active = false
     where id = p_intent_id and is_active = true;
  end if;
end;
$$;

grant execute on function public.report_matching_intent(uuid, text) to authenticated;
revoke execute on function public.report_matching_intent(uuid, text) from anon, public;

-- ---------------------------------------------------------------------------
-- 2) Limite de débit sur les demandes de mise en relation
-- ---------------------------------------------------------------------------
-- ⚠️ PORTÉE : ce trigger s'applique à TOUTES les insertions dans `follows`, pas
-- seulement à celles issues de la mise en relation — `follows` ne sait pas d'où
-- vient la demande. C'est volontaire : le vecteur de spam (arroser la base de
-- demandes) est le même quel que soit l'écran d'origine.
--
-- Le seuil (30/heure par défaut) est très au-dessus d'un usage humain normal :
-- il bloque un script, pas un utilisateur. Ajustable sans migration via
-- app_config.

create or replace function public.enforce_follow_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
begin
  select int_value into v_limit
  from public.app_config where key = 'matching_requests_per_hour';

  -- Pas de seuil configuré → pas de limite (sécurité de repli).
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.follows f
  where f.follower_id = new.follower_id
    and f.created_at > (now() - interval '1 hour');

  if v_count >= v_limit then
    raise exception 'Trop de demandes envoyées. Réessaie dans un moment.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_follow_rate_limit on public.follows;
create trigger trg_enforce_follow_rate_limit
  before insert on public.follows
  for each row execute function public.enforce_follow_rate_limit();

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   -- 1) Signaler l'intention d'un autre → OK, puis rejouer → sans effet
--   select public.report_matching_intent('<intent_autre>', 'spam');   -- => OK
--   select public.report_matching_intent('<intent_autre>', 'spam');   -- => OK (no-op)
--   select count(*) from public.matching_intent_reports
--    where intent_id = '<intent_autre>';                              -- => 1
--
--   -- 2) Signaler SA PROPRE intention → refusé
--   select public.report_matching_intent('<mon_intent>', 'spam');
--        -- => « Impossible de signaler sa propre intention »
--
--   -- 3) Motif invalide → refusé
--   select public.report_matching_intent('<intent>', 'nimportequoi');  -- => exception
--
--   -- 4) SEUIL : 3 reporters distincts → l'intention passe is_active = false
--   --    et disparaît de get_matching_candidates.
--
--   -- 5) RATE LIMIT : insérer 31 follows en moins d'une heure depuis le même
--   --    follower → la 31e lève « Trop de demandes envoyées ».
--   --    (ajuster : update public.app_config set int_value = 5
--   --     where key = 'matching_requests_per_hour';)
--
--   -- 6) Les signalements ne sont lisibles par personne en direct (RLS sans policy)
--   select count(*) from public.matching_intent_reports;               -- => 0
-- ---------------------------------------------------------------------------
