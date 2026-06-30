-- E7-16 (#247) — RPC liste des annonces favorites de l'user courant
--
-- Trie par date de bookmark (plus récent d'abord), pas par date de l'annonce.
-- C'est plus intuitif côté UX : ce qu'on vient de sauvegarder remonte en tête.
-- Cursor sur `lb.created_at` pour pagination cohérente.
--
-- Authentication requise (revoke anon/public) — la liste de favoris est
-- forcément liée à un user authentifié.
--
-- Sécurité : security definer + filtre dur `lb.user_id = auth.uid()`. Le
-- caller ne peut jamais voir les favoris d'un autre user.
--
-- Idempotent (`create or replace`), rejouable.

create or replace function public.get_my_bookmarked_listings(
  p_cursor timestamptz default null,
  p_limit int default 20
)
returns table (
  id uuid,
  seller_id uuid,
  seller_username text,
  seller_avatar_url text,
  seller_is_verified boolean,
  category text,
  title text,
  description text,
  price_cents int,
  currency text,
  images text[],
  location text,
  condition text,
  badge text,
  discount_percent int,
  view_count int,
  created_at timestamptz,
  bookmarked_at timestamptz,
  bookmarked_by_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    l.seller_id,
    p.username      as seller_username,
    p.avatar_url    as seller_avatar_url,
    p.is_verified   as seller_is_verified,
    l.category::text,
    l.title,
    l.description,
    l.price_cents,
    l.currency,
    l.images,
    l.location,
    l.condition,
    l.badge,
    l.discount_percent,
    l.view_count,
    l.created_at,
    lb.created_at   as bookmarked_at,
    true            as bookmarked_by_me
  from public.listing_bookmarks lb
  join public.listings l on l.id = lb.listing_id
  join public.profiles p on p.id = l.seller_id
  where lb.user_id = auth.uid()
    and l.is_active = true
    and (p_cursor is null or lb.created_at < p_cursor)
  order by lb.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_my_bookmarked_listings(timestamptz, int) to authenticated;
revoke execute on function public.get_my_bookmarked_listings(timestamptz, int) from anon, public;

comment on function public.get_my_bookmarked_listings(timestamptz, int) is
  'E7-16 (#247) — Liste paginée des annonces actives en favori de l''user courant. Cursor sur listing_bookmarks.created_at desc.';
