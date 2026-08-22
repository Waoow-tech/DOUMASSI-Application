-- Sécu B2 — Signalement de profil.
--
-- Il manquait une pièce à la protection des mineurs : on pouvait signaler un
-- post, une ressource Cours, une intention de mise en relation… mais PAS un
-- profil. Or c'est souvent le profil (harcèlement, faux profil) qu'on veut
-- signaler.
--
-- Même patron que resource_reports (E9) et matching_intent_reports (E13), à une
-- différence VOLONTAIRE près : PAS de désactivation automatique au seuil.
-- Désactiver/bannir un compte est une décision de modération (écran admin), pas
-- une action automatique — un simple raid de signalements ne doit pas suffire à
-- faire disparaître quelqu'un. On enregistre, la modération tranche.
--
-- Idempotent.

create table if not exists public.profile_reports (
  id               uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  reason           text not null check (reason in ('inapproprie', 'harcelement', 'spam', 'faux_profil', 'autre')),
  created_at       timestamptz not null default now(),
  unique (reported_user_id, reporter_id)   -- 1 signalement max par user et par profil
);

comment on table public.profile_reports is
  'Sécu B2 — signalements de profils. Traités par la modération (pas de bannissement auto).';

create index if not exists idx_profile_reports_reported
  on public.profile_reports (reported_user_id);

alter table public.profile_reports enable row level security;
-- Aucune policy : accessible uniquement via la RPC (security definer) et, plus
-- tard, l'écran de modération (rôle admin). Un utilisateur n'a aucune raison de
-- lire les signalements.

create or replace function public.report_profile(p_reported_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason not in ('inapproprie', 'harcelement', 'spam', 'faux_profil', 'autre') then
    raise exception 'Motif de signalement invalide';
  end if;
  if p_reported_user_id = v_user then
    raise exception 'Impossible de signaler son propre profil';
  end if;
  -- Le profil signalé doit exister.
  if not exists (select 1 from public.profiles where id = p_reported_user_id) then
    raise exception 'Profil introuvable';
  end if;

  -- Rejouer un signalement déjà fait est sans effet (pas d'erreur : l'UI ne doit
  -- pas révéler si l'utilisateur avait déjà signalé).
  insert into public.profile_reports (reported_user_id, reporter_id, reason)
  values (p_reported_user_id, v_user, p_reason)
  on conflict (reported_user_id, reporter_id) do nothing;
end;
$$;

grant execute on function public.report_profile(uuid, text) to authenticated;
revoke execute on function public.report_profile(uuid, text) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   -- 1) signaler un autre profil → OK ; rejouer → sans effet (no-op)
--   -- 2) signaler son propre profil → « Impossible de signaler son propre profil »
--   -- 3) motif invalide → exception
--   -- 4) les signalements ne sont lisibles par personne en direct (RLS sans policy)
--   select count(*) from public.profile_reports;   -- => 0 (pour un non-admin)
-- ---------------------------------------------------------------------------
