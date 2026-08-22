-- Sprint 3 : RPCs principales du feed

create or replace function public.get_feed(
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
    p.id, p.author_id,
    pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.deleted_at is null
    and public.can_view_post(p.author_id)
    and (p_cursor is null or p.created_at < p_cursor)
  order by p.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_feed(timestamptz, int) to authenticated;

create or replace function public.get_post_with_counts(p_post_id uuid)
returns table (
  id uuid, author_id uuid, author_username text, author_full_name text,
  author_avatar_url text, author_is_verified boolean,
  content text, media_urls text[], media_type text, location text, created_at timestamptz,
  like_count int, comment_count int, share_count int, bookmark_count int, view_count int,
  liked_by_me boolean, bookmarked_by_me boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.id, p.author_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    p.content, p.media_urls, p.media_type, p.location, p.created_at,
    p.like_count, p.comment_count, p.share_count, p.bookmark_count, p.view_count,
    exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()),
    exists (select 1 from public.bookmarks b where b.post_id = p.id and b.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.id = p_post_id and p.deleted_at is null and public.can_view_post(p.author_id);
$$;

grant execute on function public.get_post_with_counts(uuid) to authenticated;

create or replace function public.toggle_like(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.likes where post_id = p_post_id and user_id = v_user) then
    delete from public.likes where post_id = p_post_id and user_id = v_user;
    return false;
  else
    insert into public.likes (post_id, user_id) values (p_post_id, v_user);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_like(uuid) to authenticated;

create or replace function public.toggle_bookmark(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.bookmarks where post_id = p_post_id and user_id = v_user) then
    delete from public.bookmarks where post_id = p_post_id and user_id = v_user;
    return false;
  else
    insert into public.bookmarks (post_id, user_id) values (p_post_id, v_user);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_bookmark(uuid) to authenticated;

create or replace function public.increment_share_count(p_post_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.posts
  set share_count = share_count + 1
  where id = p_post_id and deleted_at is null
    and public.can_view_post(author_id)
  returning share_count;
$$;

grant execute on function public.increment_share_count(uuid) to authenticated;