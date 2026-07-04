-- E9-08 (#268) — Signalement de ressources + modération auto
--
-- Permet de signaler une ressource. Au-delà d'un seuil (configurable en DB,
-- défaut 3, cf brief §15.4), la ressource passe en status='hidden' et
-- disparaît du public (get_resources ne renvoie que 'active').
--
-- Seuil NON hardcodé côté client : stocké dans app_config → le changer = un
-- update SQL de 30s, pas un release.
--
-- Tout passe par la RPC report_resource (security definer) : le client n'écrit
-- jamais directement dans resource_reports ni app_config.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- app_config — table générique de config (réutilisable)
-- ---------------------------------------------------------------------------

create table if not exists public.app_config (
  key        text primary key,
  int_value  int,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Config applicative modifiable sans release (ex. seuils de modération). Écriture admin only.';

alter table public.app_config enable row level security;
-- Aucune policy → deny-by-default. Lu uniquement via RPC security definer.

insert into public.app_config (key, int_value) values
  ('resource_report_threshold', 3)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- resource_reports — un signalement par (ressource, reporter)
-- ---------------------------------------------------------------------------

create table if not exists public.resource_reports (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null check (reason in ('inapproprie', 'fausse_info', 'spam', 'autre')),
  created_at  timestamptz not null default now(),
  unique (resource_id, reporter_id) -- 1 signalement max par user par ressource
);

comment on table public.resource_reports is
  'E9-08 — Signalements de ressources. Insertion via RPC report_resource uniquement.';

alter table public.resource_reports enable row level security;
-- Aucune policy client → tout passe par la RPC security definer.

-- ---------------------------------------------------------------------------
-- RPC report_resource
-- ---------------------------------------------------------------------------

create or replace function public.report_resource(p_resource_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_author    uuid;
  v_threshold int;
  v_count     int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select author_id into v_author from public.resources where id = p_resource_id;
  if v_author is null then raise exception 'Resource not found'; end if;
  if v_author = v_user then raise exception 'Cannot report own resource'; end if;

  -- Enregistre le signalement (ignore si l'user a déjà signalé).
  insert into public.resource_reports (resource_id, reporter_id, reason)
  values (p_resource_id, v_user, p_reason)
  on conflict (resource_id, reporter_id) do nothing;

  -- Recompte le nombre de reporters distincts.
  update public.resources r
    set report_count = (
      select count(*) from public.resource_reports rr
      where rr.resource_id = p_resource_id
    )
  where r.id = p_resource_id;

  -- Masquage auto si le seuil configuré est atteint.
  select int_value into v_threshold
  from public.app_config where key = 'resource_report_threshold';

  select report_count into v_count
  from public.resources where id = p_resource_id;

  if v_threshold is not null and v_count >= v_threshold then
    update public.resources
      set status = 'hidden'
    where id = p_resource_id and status <> 'hidden';
  end if;
end;
$$;

grant execute on function public.report_resource(uuid, text) to authenticated;
revoke execute on function public.report_resource(uuid, text) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions de vérif :
--   - report_resource(<autre_id>, 'spam') en authenticated → OK, report_count+1
--   - report_resource sur SA propre ressource → exception 'Cannot report own'
--   - 3 users distincts signalent la même ressource → status passe à 'hidden',
--     la ressource disparaît de get_resources
--   - changer le seuil : update app_config set int_value = 5
--     where key = 'resource_report_threshold';
-- ---------------------------------------------------------------------------
