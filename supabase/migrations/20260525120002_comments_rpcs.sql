-- Sprint 4 : RPCs commentaires (E4-11).
--
-- Toutes SECURITY DEFINER + set search_path = public.
-- get_post_comments retourne déjà liked_by_me pour économiser un round-trip.
-- create_comment valide la visibilité du post + cohérence du parent.
-- delete_comment fait du soft delete par l'auteur (pattern soft_delete_post).
-- toggle_comment_like : INSERT/DELETE sur comment_likes, le trigger
-- maintient comments.like_count.
--
-- Appliquées via AI Supabase sur dev + staging le 25 mai 2026
-- (migration comments_rpcs).

-- ---------------------------------------------------------------------------
-- get_post_comments : threadés. Top-level d'abord, puis enfants chrono asc.
-- L'ordre composite garantit que chaque thread (root + ses enfants) reste
-- groupé dans le retour.
-- ---------------------------------------------------------------------------

create or replace function public.get_post_comments(p_post_id uuid, p_limit int default 50)
returns table (
  id uuid, post_id uuid, author_id uuid,
  author_username text, author_full_name text, author_avatar_url text, author_is_verified boolean,
  parent_comment_id uuid, content text, created_at timestamptz,
  like_count int, liked_by_me boolean
)
language sql security definer set search_path = public stable as $$
  select
    c.id, c.post_id, c.author_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    c.parent_comment_id, c.content, c.created_at,
    c.like_count,
    exists (select 1 from public.comment_likes cl where cl.comment_id = c.id and cl.user_id = auth.uid())
  from public.comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = p_post_id
    and c.deleted_at is null
    and public.can_view_post((select author_id from public.posts where id = c.post_id))
  order by
    coalesce(c.parent_comment_id, c.id),
    case when c.parent_comment_id is null then 0 else 1 end,
    c.created_at asc
  limit p_limit;
$$;

grant execute on function public.get_post_comments(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- create_comment : valide post visible + parent top-level même post (1 seul
-- niveau de profondeur, pas de réponse à une réponse).
-- ---------------------------------------------------------------------------

create or replace function public.create_comment(
  p_post_id uuid, p_content text, p_parent_comment_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if length(trim(p_content)) = 0 then raise exception 'Empty content'; end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.deleted_at is null and public.can_view_post(p.author_id)
  ) then
    raise exception 'Post not visible';
  end if;

  if p_parent_comment_id is not null then
    if not exists (
      select 1 from public.comments c
      where c.id = p_parent_comment_id and c.post_id = p_post_id
        and c.deleted_at is null and c.parent_comment_id is null
    ) then
      raise exception 'Invalid parent comment';
    end if;
  end if;

  insert into public.comments (post_id, author_id, content, parent_comment_id)
  values (p_post_id, v_user, p_content, p_parent_comment_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_comment(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_comment : soft delete par l'auteur (pattern soft_delete_post)
-- ---------------------------------------------------------------------------

create or replace function public.delete_comment(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_deleted int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.comments set deleted_at = now()
  where id = p_comment_id and author_id = auth.uid() and deleted_at is null;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.delete_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- toggle_comment_like : like/unlike. Le trigger trg_comments_like_count
-- maintient comments.like_count cohérent.
-- ---------------------------------------------------------------------------

create or replace function public.toggle_comment_like(p_comment_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.comment_likes where comment_id = p_comment_id and user_id = v_user) then
    delete from public.comment_likes where comment_id = p_comment_id and user_id = v_user;
    return false;
  else
    insert into public.comment_likes (comment_id, user_id) values (p_comment_id, v_user);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_comment_like(uuid) to authenticated;

-- Hygiène : revoke anon/public sur les 4 RPCs
revoke execute on function public.get_post_comments(uuid, int) from anon, public;
revoke execute on function public.create_comment(uuid, text, uuid) from anon, public;
revoke execute on function public.delete_comment(uuid) from anon, public;
revoke execute on function public.toggle_comment_like(uuid) from anon, public;