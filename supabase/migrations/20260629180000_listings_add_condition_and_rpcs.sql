-- E7 Marketplace L0 — enrichissement listings + RPCs marketplace.
--
-- ⚠️  Cette migration est une SUITE, pas un point de départ.
--
-- Pré-requis (créés avant cette migration, probablement Sprint 0) :
--   - enum `public.listing_category` avec les valeurs 'product', 'service'
--   - table `public.listings`
--   - table `public.listing_bookmarks`
--   - RLS complète sur les 2 tables (SELECT public sur listings actives,
--     écriture owner-only, default auth.uid() sur listing_bookmarks.user_id)
--
-- Si rejouée sur un env vierge sans cet historique, le cast `::listing_category`
-- dans create_listing échouera. Sur DEV/STAGING/PROD : tout l'historique est en
-- place, rejouable sans erreur (add column if not exists + create or replace).
--
-- Cette migration ajoute :
--   - colonne listings.condition (text avec check 4 valeurs FR)
--   - 5 RPCs : get_listings, get_listing_detail, toggle_listing_bookmark,
--     get_similar_listings, create_listing
--
-- Trace : ce SQL a déjà été appliqué sur DEV (kbysmkhalnolbsojzahf) et
-- STAGING (sdapojfdwduhuyduymxk) en direct via AI Supabase, vérifié colonne
-- par colonne + listes RPCs. Ce fichier est un commit de tracking pour
-- aligner le repo avec la DB et permettre le rejouage propre sur PROD.
--
-- Cohérent avec le brief Marketplace L0 du 29 juin 2026.

alter table public.listings
  add column if not exists condition text
    check (condition in ('neuf', 'tres_bon_etat', 'bon_etat', 'occasion'));

-- RPC get_listings : grille paginée avec tri + filtres (catégorie, état,
-- fourchette de prix), jointe avec le profil vendeur, et bookmarked_by_me
create or replace function public.get_listings(
  p_category text default null,
  p_condition text default null,
  p_min_price_cents int default null,
  p_max_price_cents int default null,
  p_sort text default 'recent', -- 'recent' | 'price_asc' | 'price_desc' | 'popular'
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
  bookmarked_by_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id, l.seller_id,
    pr.username, pr.avatar_url, coalesce(pr.is_verified, false),
    l.category::text, l.title, l.description, l.price_cents, l.currency,
    l.images, l.location, l.condition, l.badge, l.discount_percent,
    l.view_count, l.created_at,
    exists (
      select 1 from public.listing_bookmarks b
      where b.listing_id = l.id and b.user_id = auth.uid()
    )
  from public.listings l
  join public.profiles pr on pr.id = l.seller_id
  where l.is_active = true
    and (p_category is null or l.category::text = p_category)
    and (p_condition is null or l.condition = p_condition)
    and (p_min_price_cents is null or l.price_cents >= p_min_price_cents)
    and (p_max_price_cents is null or l.price_cents <= p_max_price_cents)
    and (p_cursor is null or l.created_at < p_cursor)
  order by
    case when p_sort = 'price_asc' then l.price_cents end asc,
    case when p_sort = 'price_desc' then l.price_cents end desc,
    case when p_sort = 'popular' then l.view_count end desc,
    l.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_listings(text, text, int, int, text, timestamptz, int) to authenticated, anon;

-- RPC get_listing_detail : fiche produit complète, incrémente la vue
create or replace function public.get_listing_detail(p_listing_id uuid)
returns table (
  id uuid,
  seller_id uuid,
  seller_username text,
  seller_full_name text,
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
  bookmarked_by_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings set view_count = view_count + 1
  where id = p_listing_id and is_active = true;

  return query
  select
    l.id, l.seller_id, pr.username, pr.full_name, pr.avatar_url,
    coalesce(pr.is_verified, false),
    l.category::text, l.title, l.description, l.price_cents, l.currency,
    l.images, l.location, l.condition, l.badge, l.discount_percent,
    l.view_count, l.created_at,
    exists (
      select 1 from public.listing_bookmarks b
      where b.listing_id = l.id and b.user_id = auth.uid()
    )
  from public.listings l
  join public.profiles pr on pr.id = l.seller_id
  where l.id = p_listing_id and l.is_active = true;
end;
$$;

grant execute on function public.get_listing_detail(uuid) to authenticated, anon;

-- RPC toggle_listing_bookmark : insert/delete atomique
create or replace function public.toggle_listing_bookmark(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.listing_bookmarks where listing_id = p_listing_id and user_id = v_user) then
    delete from public.listing_bookmarks where listing_id = p_listing_id and user_id = v_user;
    return false;
  else
    insert into public.listing_bookmarks (listing_id, user_id) values (p_listing_id, v_user);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_listing_bookmark(uuid) to authenticated;
revoke execute on function public.toggle_listing_bookmark(uuid) from anon, public;

-- RPC get_similar_listings : annonces similaires (même catégorie, hors annonce courante)
create or replace function public.get_similar_listings(p_listing_id uuid, p_limit int default 4)
returns table (
  id uuid,
  title text,
  price_cents int,
  currency text,
  images text[],
  badge text,
  discount_percent int
)
language sql
security definer
set search_path = public
stable
as $$
  select l2.id, l2.title, l2.price_cents, l2.currency, l2.images, l2.badge, l2.discount_percent
  from public.listings l2
  where l2.is_active = true
    and l2.id <> p_listing_id
    and l2.category = (select category from public.listings where id = p_listing_id)
  order by l2.view_count desc
  limit p_limit;
$$;

grant execute on function public.get_similar_listings(uuid, int) to authenticated, anon;

-- create_listing : création d'annonce (owner = auth.uid() forcé, pas de spoof possible)
create or replace function public.create_listing(
  p_category text,
  p_title text,
  p_description text,
  p_price_cents int,
  p_currency text default 'EUR',
  p_images text[] default array[]::text[],
  p_location text default null,
  p_condition text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  insert into public.listings (
    seller_id, category, title, description, price_cents, currency,
    images, location, condition
  ) values (
    v_user, p_category::listing_category, p_title, p_description, p_price_cents, p_currency,
    p_images, p_location, p_condition
  )
  returning id into v_new_id;
  return v_new_id;
end;
$$;

grant execute on function public.create_listing(text, text, text, int, text, text[], text, text) to authenticated;
revoke execute on function public.create_listing(text, text, text, int, text, text[], text, text) from anon, public;
