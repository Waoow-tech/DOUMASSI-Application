-- E9-02 (#262) — Ressources UGC de la verticale Cours + RLS + RPCs
--
-- Une "ressource" = un contenu pédagogique partagé par un utilisateur, rangé
-- dans la taxonomie (niveau × matière × type). Fichiers stockés dans le bucket
-- `resources` (E9-03). Le quiz est un objet SÉPARÉ (E9-10), pas un type de
-- ressource ici.
--
-- Patterns strictement calqués sur la marketplace (listings) déjà testée :
--   - RPC get_resources = clone de get_listings (paginé, filtres, cursor)
--   - RPC get_resource_detail = clone de get_listing_detail AVEC le fix du
--     bug "id ambigu" (on qualifie public.resources.id dans le UPDATE)
--   - RPC create_resource = owner forcé à auth.uid()
--   - RPC toggle_resource_bookmark
--
-- RLS deny-by-default. Modération : le masquage (status='hidden') se fait via
-- service role / admin, hors RLS client.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  level_code   text not null references public.course_levels(code),
  subject_code text not null references public.course_subjects(code),
  -- Types de ressource "fichier". Le quiz est un objet à part (E9-10).
  type         text not null check (type in ('cours', 'fiche_revision', 'exercices', 'annale')),
  title        text not null,
  description  text,
  files        text[] not null default array[]::text[],
  -- Modération : active (visible) / reported (signalée, encore visible) /
  -- hidden (masquée par la modération, invisible du public).
  status       text not null default 'active' check (status in ('active', 'reported', 'hidden')),
  report_count int  not null default 0,
  view_count   int  not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.resources is
  'E9-02 — Ressources pédagogiques UGC (cours/fiches/exos/annales). Quiz = objet séparé.';

create index if not exists idx_resources_level_subject
  on public.resources (level_code, subject_code);
create index if not exists idx_resources_created_at
  on public.resources (created_at desc);

create table if not exists public.resource_bookmarks (
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

comment on table public.resource_bookmarks is
  'E9-02 — Favoris ressources (table dédiée, cf brief §15.2).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.resources         enable row level security;
alter table public.resource_bookmarks enable row level security;

-- Lecture : tout le monde voit les ressources actives ; l'auteur voit aussi
-- les siennes quel que soit le statut (pour les retrouver si masquées).
drop policy if exists "resources read active or own" on public.resources;
create policy "resources read active or own"
  on public.resources
  for select
  to anon, authenticated
  using (status = 'active' or author_id = auth.uid());

-- Écriture : l'auteur crée/modifie/supprime ses propres ressources.
drop policy if exists "resources insert own" on public.resources;
create policy "resources insert own"
  on public.resources
  for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "resources update own" on public.resources;
create policy "resources update own"
  on public.resources
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "resources delete own" on public.resources;
create policy "resources delete own"
  on public.resources
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Bookmarks : chacun gère les siens.
drop policy if exists "resource_bookmarks select own" on public.resource_bookmarks;
create policy "resource_bookmarks select own"
  on public.resource_bookmarks
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "resource_bookmarks insert own" on public.resource_bookmarks;
create policy "resource_bookmarks insert own"
  on public.resource_bookmarks
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "resource_bookmarks delete own" on public.resource_bookmarks;
create policy "resource_bookmarks delete own"
  on public.resource_bookmarks
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC get_resources — grille paginée + filtres + recherche
-- ---------------------------------------------------------------------------

create or replace function public.get_resources(
  p_level_code   text default null,
  p_subject_code text default null,
  p_type         text default null,
  p_search       text default null,
  p_sort         text default 'recent',   -- 'recent' | 'popular'
  p_cursor       timestamptz default null,
  p_limit        int default 20
)
returns table (
  id                 uuid,
  author_id          uuid,
  author_username    text,
  author_avatar_url  text,
  author_is_verified boolean,
  level_code         text,
  subject_code       text,
  type               text,
  title              text,
  description        text,
  files              text[],
  view_count         int,
  created_at         timestamptz,
  bookmarked_by_me   boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.author_id, p.username, p.avatar_url, coalesce(p.is_verified, false),
    r.level_code, r.subject_code, r.type, r.title, r.description, r.files,
    r.view_count, r.created_at,
    exists (
      select 1 from public.resource_bookmarks b
      where b.resource_id = r.id and b.user_id = auth.uid()
    )
  from public.resources r
  join public.profiles p on p.id = r.author_id
  where r.status = 'active'
    and (p_level_code   is null or r.level_code = p_level_code)
    and (p_subject_code is null or r.subject_code = p_subject_code)
    and (p_type         is null or r.type = p_type)
    and (
      p_search is null
      or r.title ilike '%' || p_search || '%'
      or coalesce(r.description, '') ilike '%' || p_search || '%'
    )
    -- Cursor sur created_at (pagination cohérente pour le tri 'recent').
    and (p_cursor is null or r.created_at < p_cursor)
  order by
    case when p_sort = 'popular' then r.view_count end desc nulls last,
    r.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_resources(text, text, text, text, text, timestamptz, int)
  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC get_resource_detail — fiche + incrément view_count
-- ATTENTION : bug "id ambigu" corrigé (cf get_listing_detail). On qualifie
-- explicitement public.resources.id dans le UPDATE car le RETURNS TABLE
-- déclare `id` comme OUT parameter qui masquerait resources.id.
-- ---------------------------------------------------------------------------

create or replace function public.get_resource_detail(p_resource_id uuid)
returns table (
  id                 uuid,
  author_id          uuid,
  author_username    text,
  author_full_name   text,
  author_avatar_url  text,
  author_is_verified boolean,
  level_code         text,
  subject_code       text,
  type               text,
  title              text,
  description        text,
  files              text[],
  status             text,
  view_count         int,
  created_at         timestamptz,
  bookmarked_by_me   boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Incrément de la vue — colonnes QUALIFIÉES pour éviter le conflit avec
  -- l'OUT parameter `id`/`view_count` du RETURNS TABLE.
  update public.resources
    set view_count = public.resources.view_count + 1
  where public.resources.id = p_resource_id
    and public.resources.status = 'active';

  return query
  select
    r.id, r.author_id, p.username, p.full_name, p.avatar_url,
    coalesce(p.is_verified, false),
    r.level_code, r.subject_code, r.type, r.title, r.description, r.files,
    r.status, r.view_count, r.created_at,
    exists (
      select 1 from public.resource_bookmarks b
      where b.resource_id = r.id and b.user_id = auth.uid()
    )
  from public.resources r
  join public.profiles p on p.id = r.author_id
  where r.id = p_resource_id
    and (r.status = 'active' or r.author_id = auth.uid());
end;
$$;

grant execute on function public.get_resource_detail(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC create_resource — owner forcé à auth.uid()
-- ---------------------------------------------------------------------------

create or replace function public.create_resource(
  p_type         text,
  p_level_code   text,
  p_subject_code text,
  p_title        text,
  p_description  text default null,
  p_files        text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  insert into public.resources (
    author_id, type, level_code, subject_code, title, description, files
  ) values (
    v_user, p_type, p_level_code, p_subject_code, p_title, p_description, p_files
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_resource(text, text, text, text, text, text[])
  to authenticated;
revoke execute on function public.create_resource(text, text, text, text, text, text[])
  from anon, public;

-- ---------------------------------------------------------------------------
-- RPC toggle_resource_bookmark — retourne le NOUVEL état (true = bookmarked)
-- ---------------------------------------------------------------------------

create or replace function public.toggle_resource_bookmark(p_resource_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if exists (
    select 1 from public.resource_bookmarks
    where resource_id = p_resource_id and user_id = v_user
  ) then
    delete from public.resource_bookmarks
    where resource_id = p_resource_id and user_id = v_user;
    return false;
  else
    insert into public.resource_bookmarks (resource_id, user_id)
    values (p_resource_id, v_user);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_resource_bookmark(uuid) to authenticated;
revoke execute on function public.toggle_resource_bookmark(uuid) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions de vérif (après application) :
--   - insert d'une ressource en tant qu'authenticated avec author_id = moi → OK
--   - insert avec author_id d'un autre → refusé (with check)
--   - select get_resources() en anon → ne renvoie que les 'active'
--   - get_resource_detail(<id>) → 1 ligne + view_count +1 (idempotence du fix)
-- ---------------------------------------------------------------------------
