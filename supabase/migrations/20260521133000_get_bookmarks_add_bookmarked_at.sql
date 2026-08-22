-- E4-07 — Correction de get_bookmarks : ajout de bookmarked_at au retour.
--
-- La version initiale (20260521120000_get_bookmarks_rpc.sql) ordonnait par
-- date de bookmark (b.created_at) mais ne la retournait pas → le
-- useInfiniteQuery ne pouvait pas calculer le curseur de la page suivante
-- (pagination cassée au-delà de 20 posts).
--
-- On expose donc `bookmarked_at` (= b.created_at) dans le retour. Le
-- RETURNS TABLE change de signature → DROP + CREATE obligatoire
-- (`create or replace` refuse un changement de type de retour).
--
-- Visibilité : on réutilise can_view_post(author_id) (cf.
-- 20260514120000_rls_private_profiles_posts.sql) pour ne pas exposer un
-- post devenu non visible (compte passé en privé, bloqué, etc.) — la RPC
-- est SECURITY DEFINER, donc on ne court-circuite pas la RLS posts SELECT.
--
-- Appliqué via AI Supabase (DROP + CREATE) sur dev + staging le 21 mai 2026
-- (migration get_bookmarks_add_bookmarked_at).

drop function if exists public.get_bookmarks(timestamptz, int);

create function public.get_bookmarks(
  p_cursor timestamptz default null,
  p_limit int default 20
)
returns table (
  id uuid,
  author_id uuid,
  author_username text,
  author_full_name text,
  author_avatar_url text,
  author_is_verified boolean,
  content text,
  media_urls text[],
  media_type text,
  location text,
  created_at timestamptz,
  bookmarked_at timestamptz,
  like_count int,
  comment_count int,
  share_count int,
  bookmark_count int,
  view_count int,
  liked_by_me boolean,
  bookmarked_by_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.author_id,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    coalesce(pr.is_verified, false),
    p.content,
    p.media_urls,
    p.media_type,
    p.location,
    p.created_at,
    b.created_at as bookmarked_at,
    p.like_count,
    p.comment_count,
    p.share_count,
    p.bookmark_count,
    p.view_count,
    exists (
      select 1 from public.likes l
      where l.post_id = p.id and l.user_id = auth.uid()
    ),
    true as bookmarked_by_me
  from public.bookmarks b
  join public.posts p on p.id = b.post_id
  join public.profiles pr on pr.id = p.author_id
  where b.user_id = auth.uid()
    and p.deleted_at is null
    and public.can_view_post(p.author_id)
    and (p_cursor is null or b.created_at < p_cursor)
  order by b.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_bookmarks(timestamptz, int) to authenticated;