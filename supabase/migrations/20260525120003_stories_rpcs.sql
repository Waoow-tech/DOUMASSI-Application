-- Sprint 4 : RPCs stories (E4-12 / E4-13).
--
-- get_stories_feed : liste des stories actives groupées par auteur, mes
-- stories en 1er. Le client groupera par author_id côté UI (Instagram-like).
-- create_story_view : idempotent via PK composite (story_id, viewer_id).
-- get_story_viewers : réservé à l'auteur de la story.
--
-- Appliquées via AI Supabase sur dev + staging le 25 mai 2026
-- (migration stories_rpcs).

-- ---------------------------------------------------------------------------
-- get_stories_feed : stories actives (mes follows acceptés + moi).
-- expires_at > now() filtre les stories expirées (purge pg_cron à 3h, mais
-- on filtre quand même pour la fenêtre d'inertie entre l'expiration et la purge).
-- ---------------------------------------------------------------------------

create or replace function public.get_stories_feed()
returns table (
  id uuid, author_id uuid,
  author_username text, author_avatar_url text, author_is_verified boolean,
  media_url text, media_type text, thumbnail_url text, duration_seconds int,
  created_at timestamptz, expires_at timestamptz,
  viewed_by_me boolean, is_mine boolean
)
language sql security definer set search_path = public stable as $$
  with my_follows as (
    select followed_id from public.follows
    where follower_id = auth.uid() and status = 'accepted'
  )
  select
    s.id, s.author_id,
    pr.username, pr.avatar_url, coalesce(pr.is_verified, false),
    s.media_url, s.media_type, s.thumbnail_url, s.duration_seconds,
    s.created_at, s.expires_at,
    exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
    s.author_id = auth.uid()
  from public.stories s
  join public.profiles pr on pr.id = s.author_id
  where s.expires_at > now()
    and (s.author_id = auth.uid() or s.author_id in (select followed_id from my_follows))
  order by
    case when s.author_id = auth.uid() then 0 else 1 end,
    s.created_at desc;
$$;

grant execute on function public.get_stories_feed() to authenticated;

-- ---------------------------------------------------------------------------
-- create_story_view : marque une story comme vue. Idempotent via la PK
-- composite (story_id, viewer_id) — pas de doublon si le viewer revoit.
-- ---------------------------------------------------------------------------

create or replace function public.create_story_view(p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  insert into public.story_views (story_id, viewer_id) values (p_story_id, v_user)
  on conflict (story_id, viewer_id) do nothing;
end;
$$;

grant execute on function public.create_story_view(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_story_viewers : liste « vu par » pour l'auteur de la story uniquement.
-- Le where s.author_id = auth.uid() empêche un viewer de voir qui d'autre
-- a vu (même si la RLS de story_views permettait déjà au viewer de voir
-- sa propre ligne).
-- ---------------------------------------------------------------------------

create or replace function public.get_story_viewers(p_story_id uuid)
returns table (viewer_id uuid, viewer_username text, viewer_avatar_url text, viewed_at timestamptz)
language sql security definer set search_path = public stable as $$
  select v.viewer_id, pr.username, pr.avatar_url, v.viewed_at
  from public.story_views v
  join public.profiles pr on pr.id = v.viewer_id
  join public.stories s on s.id = v.story_id
  where v.story_id = p_story_id and s.author_id = auth.uid()
  order by v.viewed_at desc;
$$;

grant execute on function public.get_story_viewers(uuid) to authenticated;

-- Hygiène : revoke anon/public
revoke execute on function public.get_stories_feed() from anon, public;
revoke execute on function public.create_story_view(uuid) from anon, public;
revoke execute on function public.get_story_viewers(uuid) from anon, public;