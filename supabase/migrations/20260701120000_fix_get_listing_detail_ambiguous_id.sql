-- Fix — get_listing_detail : conflit de noms "id" ambigu dans le UPDATE
--
-- Contexte : bug remonté au bug bash Marketplace L0 du 2026-07-01. Sur le
-- Dev Build, taper sur une card produit affichait "Annonce introuvable"
-- au lieu de la fiche. Même symptôme après création d'annonce
-- (router.replace('/shop/[newId]') → 404). Le compteur de vues ne
-- s'incrémentait pas non plus.
--
-- Cause racine : dans la version précédente de la RPC (migration
-- 20260629180000_listings_add_condition_and_rpcs.sql, lignes 122-125) :
--
--   returns table (id uuid, ...)
--   ...
--   update public.listings set view_count = view_count + 1
--   where id = p_listing_id and is_active = true;
--
-- La clause RETURNS TABLE déclare `id` comme OUT parameter, ce qui masque
-- `listings.id` dans le corps PL/pgSQL. Le UPDATE ne match plus aucune
-- ligne → view_count reste inchangé + le SELECT retourne 0 rows →
-- "Annonce introuvable" côté client.
--
-- Fix : qualifier explicitement `listings.id` et `listings.view_count`
-- dans le UPDATE. Le SELECT en dessous utilise déjà l'alias `l.` donc
-- pas affecté.
--
-- Diagnostiqué + appliqué en direct sur DEV + STAGING via AI Supabase.
-- Vérifié : `select * from get_listing_detail(<uuid>)` retourne 1 ligne
-- et incrémente view_count.
--
-- Idempotent (create or replace), rejouable.

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
  -- Qualification explicite `listings.` pour éviter le conflit de nom
  -- avec la colonne `id` du RETURNS TABLE.
  update public.listings
    set view_count = public.listings.view_count + 1
  where public.listings.id = p_listing_id
    and public.listings.is_active = true;

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
