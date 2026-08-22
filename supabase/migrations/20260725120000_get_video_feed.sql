-- E14-02 — Fil vidéo plein écran.
--
-- Même contenu que get_feed, restreint aux posts vidéo. Sert le défilement
-- vertical plein écran ouvert depuis le feed social.
--
-- POURQUOI UNE RPC DÉDIÉE plutôt qu'un filtre côté client sur get_feed :
-- les vidéos sont minoritaires dans le fil. Filtrer une page de 20 posts
-- côté client peut en laisser 1 ou 2 — l'écran demanderait alors page après
-- page pour remplir un seul écran de défilement. Le filtre appartient au SQL.
--
-- C'est une fonction NOUVELLE, pas une modification de get_feed : aucun type
-- de retour existant n'est touché, donc pas de drop/recreate à orchestrer.
--
-- Les garde-fous de visibilité sont ceux de get_feed, à l'identique :
-- `deleted_at is null` + `can_view_post` (comptes privés et blocages).
-- ⚠️ Toute évolution des règles de visibilité doit être répercutée ici AUSSI :
-- ce sont deux copies de la même clause `where`.
--
-- Idempotent (create or replace sur une fonction qui n'existait pas).

create or replace function public.get_video_feed(
  p_cursor timestamptz default null,
  p_limit  integer default 20
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
  like_count integer,
  comment_count integer,
  share_count integer,
  bookmark_count integer,
  view_count integer,
  liked_by_me boolean,
  bookmarked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
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
    and p.media_type = 'video'
    and public.can_view_post(p.author_id)
    and (p_cursor is null or p.created_at < p_cursor)
  order by p.created_at desc
  limit least(coalesce(p_limit, 20), 50);
$$;

grant execute on function public.get_video_feed(timestamptz, integer) to authenticated;
revoke execute on function public.get_video_feed(timestamptz, integer) from anon, public;

-- ---------------------------------------------------------------------------
-- Index de couverture : sans lui, chaque page fait un scan complet de `posts`
-- pour ne garder qu'une minorité de lignes. Partiel — il ne porte que sur les
-- vidéos non supprimées, donc il reste petit.
-- ---------------------------------------------------------------------------

create index if not exists idx_posts_video_created_at
  on public.posts (created_at desc)
  where media_type = 'video' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   -- 1) Ne renvoie que des vidéos
--   select distinct media_type from public.get_video_feed();   -- => 'video'
--
--   -- 2) Respecte les blocages / comptes privés (même clause que get_feed)
--   --    → un post vidéo d'un compte bloqué ne doit pas apparaître.
--
--   -- 3) anon n'a pas le droit d'exécuter
--   --    set role anon; select public.get_video_feed();        -- => permission denied
-- ---------------------------------------------------------------------------
