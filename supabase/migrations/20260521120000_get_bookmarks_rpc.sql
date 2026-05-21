-- Sprint 3 : RPC get_bookmarks — liste paginée des posts sauvegardés par l'user.
-- Préreq pour E4-07 (écran /bookmarks).
-- Appliquée via AI Supabase sur dev + staging le 21 mai 2026 (migration get_bookmarks_rpc).
-- Même forme de retour que get_feed : renvoie liked_by_me + bookmarked_by_me
-- (toujours true ici puisqu'on liste justement les bookmarks de l'user).

create or replace function public.get_bookmarks(
  p_cursor timestamptz default null,
  p_limit int default 20
)
returns table (
  id uuid, author_id uuid, author_username text, author_full_name text,
  author_avatar_url text, author_is_verified boolean,
  content text, media_urls text[], media_type text, location text, created_at timestamptz,
  like_count int, comment_count int, share_count int, bookmark_count int, view_count int,
  liked_by_me boolean, bookmarked_by_me boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.author_id, pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
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