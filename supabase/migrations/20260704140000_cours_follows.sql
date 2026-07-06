-- E9-14 (#274) — Suivre une matière/niveau + fil dédié
--
-- Table générique cours_follows : un user suit soit une matière (kind='subject')
-- soit un niveau (kind='level'), via un code de la taxonomie. Le "fil dédié"
-- = les ressources actives des matières/niveaux suivis, triées par récence.
--
-- Idempotent.

create table if not exists public.cours_follows (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('subject', 'level')),
  code       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, code)
);

comment on table public.cours_follows is
  'E9-14 — Suivis matière/niveau de la verticale Cours (fil personnalisé).';

alter table public.cours_follows enable row level security;

-- Chacun gère ses propres suivis.
drop policy if exists "cours_follows select own" on public.cours_follows;
create policy "cours_follows select own"
  on public.cours_follows for select to authenticated using (user_id = auth.uid());

drop policy if exists "cours_follows insert own" on public.cours_follows;
create policy "cours_follows insert own"
  on public.cours_follows for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "cours_follows delete own" on public.cours_follows;
create policy "cours_follows delete own"
  on public.cours_follows for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC toggle_cours_follow — suit/ne suit plus, retourne le nouvel état
-- ---------------------------------------------------------------------------

create or replace function public.toggle_cours_follow(p_kind text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('subject', 'level') then raise exception 'Invalid kind'; end if;

  if exists (
    select 1 from public.cours_follows
    where user_id = v_user and kind = p_kind and code = p_code
  ) then
    delete from public.cours_follows
    where user_id = v_user and kind = p_kind and code = p_code;
    return false;
  else
    insert into public.cours_follows (user_id, kind, code)
    values (v_user, p_kind, p_code);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_cours_follow(text, text) to authenticated;
revoke execute on function public.toggle_cours_follow(text, text) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_my_cours_follows — mes suivis (pour l'affichage des boutons)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_cours_follows()
returns table (kind text, code text)
language sql
security definer
set search_path = public
stable
as $$
  select kind, code from public.cours_follows where user_id = auth.uid();
$$;

grant execute on function public.get_my_cours_follows() to authenticated;
revoke execute on function public.get_my_cours_follows() from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_followed_resources — fil des ressources des matières/niveaux suivis
-- ---------------------------------------------------------------------------

create or replace function public.get_followed_resources(
  p_cursor timestamptz default null,
  p_limit  int default 20
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
    and (
      exists (
        select 1 from public.cours_follows f
        where f.user_id = auth.uid() and f.kind = 'subject' and f.code = r.subject_code
      )
      or exists (
        select 1 from public.cours_follows f
        where f.user_id = auth.uid() and f.kind = 'level' and f.code = r.level_code
      )
    )
    and (p_cursor is null or r.created_at < p_cursor)
  order by r.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_followed_resources(timestamptz, int) to authenticated;
revoke execute on function public.get_followed_resources(timestamptz, int) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions :
--   - toggle_cours_follow('subject','maths') → true puis false
--   - get_my_cours_follows() → lignes {kind, code}
--   - get_followed_resources() → ressources des matières/niveaux suivis
-- ---------------------------------------------------------------------------
