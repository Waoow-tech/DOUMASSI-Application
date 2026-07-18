-- E12-09 (#343) — Wallet : premier puits — booster une annonce en Dcoins
--
-- Voir ADR-005. Branche enfin `wallet_spend` : jusqu'ici on pouvait gagner et
-- faire circuler des Dcoins, mais rien ne les retirait de la circulation.
--
-- On paie ici la PROMOTION (mise en avant), pas le produit — l'achat des
-- produits reste en argent réel (Phase 3). Cohérent avec le modèle CTO.
--
-- Design anti-régression sur la pagination : les annonces boostées ne sont PAS
-- réordonnées dans la liste principale (ça casserait la pagination keyset sur
-- created_at). Elles sont exposées par une RPC séparée `get_boosted_listings`,
-- destinée à une section « Sponsorisé » en tête du marketplace.
--
-- Idempotent (migration).

-- ---------------------------------------------------------------------------
-- Barème : 50 Dcoins pour 7 jours de mise en avant. [BARÈME]
-- ---------------------------------------------------------------------------

-- Colonne : jusqu'à quand l'annonce est mise en avant (null = jamais boostée).
alter table public.listings
  add column if not exists boosted_until timestamptz;

comment on column public.listings.boosted_until is
  'E12-09 — mise en avant payée en Dcoins active tant que > now(). Voir boost_listing.';

-- Index partiel : ne référence que les boosts actifs (requête get_boosted_listings).
create index if not exists idx_listings_boosted_active
  on public.listings (boosted_until desc)
  where boosted_until is not null;

-- ---------------------------------------------------------------------------
-- RPC boost_listing — dépense des Dcoins + prolonge la mise en avant
-- ---------------------------------------------------------------------------
-- Atomique : le débit (_wallet_apply) et la maj boosted_until sont dans la même
-- transaction. Si le solde est insuffisant, _wallet_apply lève → tout est
-- annulé, l'annonce n'est pas boostée.
--
-- Seul le VENDEUR peut booster sa propre annonce. Idempotence via la clé
-- fournie par le client (double-tap / retry réseau => une seule dépense).
--
-- Prolongation : on repart de max(now(), boost courant) + 7 jours, donc booster
-- deux fois cumule le temps au lieu de l'écraser.

create or replace function public.boost_listing(
  p_listing_id      uuid,
  p_idempotency_key text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_seller     uuid;
  v_new_until  timestamptz;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key requis';
  end if;

  -- L'annonce existe et m'appartient ?
  select seller_id into v_seller
  from public.listings
  where id = p_listing_id and is_active = true;

  if not found then
    raise exception 'Annonce introuvable';
  end if;
  if v_seller <> v_user then
    raise exception 'Seul le vendeur peut booster son annonce';
  end if;

  -- [BARÈME] 50 Dcoins. Débit (puits 'purchase'), atomique + idempotent.
  perform public._wallet_apply(
    v_user, -50, 'purchase', p_idempotency_key,
    null, 'listing_boost', p_listing_id,
    jsonb_build_object('reason', 'listing_boost', 'days', 7)
  );

  -- [BARÈME] +7 jours, cumulables.
  update public.listings
     set boosted_until = greatest(now(), coalesce(boosted_until, now())) + interval '7 days'
   where id = p_listing_id
  returning boosted_until into v_new_until;

  return v_new_until;
end;
$$;

grant execute on function public.boost_listing(uuid, text) to authenticated;
revoke execute on function public.boost_listing(uuid, text) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_boosted_listings — annonces à mise en avant active (section Sponsorisé)
-- ---------------------------------------------------------------------------
-- Mêmes colonnes que get_listings (pour réutiliser le même mapper/carte côté
-- app). Triées par boost le plus récent d'abord. Pas de pagination : c'est une
-- courte vitrine en tête de marketplace.

create or replace function public.get_boosted_listings(p_limit int default 10)
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
    and l.boosted_until is not null
    and l.boosted_until > now()
  order by l.boosted_until desc
  limit p_limit;
$$;

grant execute on function public.get_boosted_listings(int) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   - select public.boost_listing('<mon_annonce>', 'boost-1'); → boosted_until ~ now()+7j
--     et solde débité de 50 (voir wallet_transactions type 'purchase').
--   - rejouer la même clé 'boost-1' → pas de 2e débit (idempotence).
--   - booster l'annonce d'un AUTRE vendeur → exception 'Seul le vendeur...'.
--   - solde < 50 → exception 'Solde insuffisant', annonce NON boostée (rollback).
--   - select public.get_boosted_listings(10); → contient l'annonce boostée.
--   - Invariant wallet conservé (solde == somme du ledger).
-- ---------------------------------------------------------------------------
