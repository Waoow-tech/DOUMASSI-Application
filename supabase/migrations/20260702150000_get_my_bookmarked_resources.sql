-- E9-07 (#267) — RPC liste des ressources favorites de l'user courant
--
-- Même patron que get_my_bookmarked_listings (marketplace) : tri par date de
-- bookmark (plus récent d'abord), cursor sur resource_bookmarks.created_at
-- exposé en `bookmarked_at` pour une pagination cohérente côté client.
--
-- Authentification requise (revoke anon/public). Filtre dur
-- rb.user_id = auth.uid() → impossible de voir les favoris d'un autre.
--
-- On ne renvoie que les ressources encore 'active' (une ressource masquée par
-- la modération disparaît des favoris).
--
-- Idempotent (create or replace).

create or replace function public.get_my_bookmarked_resources(
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
  bookmarked_at      timestamptz,
  bookmarked_by_me   boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.author_id,
    p.username      as author_username,
    p.avatar_url    as author_avatar_url,
    coalesce(p.is_verified, false) as author_is_verified,
    r.level_code,
    r.subject_code,
    r.type,
    r.title,
    r.description,
    r.files,
    r.view_count,
    r.created_at,
    rb.created_at   as bookmarked_at,
    true            as bookmarked_by_me
  from public.resource_bookmarks rb
  join public.resources r on r.id = rb.resource_id
  join public.profiles p on p.id = r.author_id
  where rb.user_id = auth.uid()
    and r.status = 'active'
    and (p_cursor is null or rb.created_at < p_cursor)
  order by rb.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_my_bookmarked_resources(timestamptz, int) to authenticated;
revoke execute on function public.get_my_bookmarked_resources(timestamptz, int) from anon, public;

comment on function public.get_my_bookmarked_resources(timestamptz, int) is
  'E9-07 (#267) — Ressources actives en favori de l''user courant, triées par date de bookmark desc.';
