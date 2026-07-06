-- E9-15 (#275) — Réputation auteur (dérivée, pas de table de points)
--
-- La réputation d'un auteur dans la verticale Cours est calculée à la volée à
-- partir de son activité : nombre de ressources actives publiées + nombre de
-- sauvegardes (bookmarks) reçues sur ses ressources. On en dérive un palier
-- (tier) affiché sous forme de badge.
--
-- Aucune table dédiée (cf brief §8 : "réputation dérivée"). Fonction
-- security definer + stable, lecture publique (badge visible sans compte).
--
-- Paliers (seuils volontairement simples pour le MVP) :
--   - expert       : >= 15 ressources OU >= 50 bookmarks reçus
--   - confirme     : >= 5  ressources OU >= 10 bookmarks reçus
--   - contributeur : >= 1  ressource
--   - none         : aucune ressource active
--
-- Idempotent.

create or replace function public.get_author_reputation(p_author_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with stats as (
    select
      (
        select count(*) from public.resources r
        where r.author_id = p_author_id and r.status = 'active'
      ) as resource_count,
      (
        select count(*)
        from public.resource_bookmarks rb
        join public.resources r on r.id = rb.resource_id
        where r.author_id = p_author_id and r.status = 'active'
      ) as bookmarks_received
  )
  select jsonb_build_object(
    'resource_count', s.resource_count,
    'bookmarks_received', s.bookmarks_received,
    'tier', case
      when s.resource_count >= 15 or s.bookmarks_received >= 50 then 'expert'
      when s.resource_count >= 5  or s.bookmarks_received >= 10 then 'confirme'
      when s.resource_count >= 1                                then 'contributeur'
      else 'none'
    end
  )
  from stats s;
$$;

grant execute on function public.get_author_reputation(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Post-condition : get_author_reputation('<uuid auteur>') →
--   { "resource_count": N, "bookmarks_received": M, "tier": "…" }
-- ---------------------------------------------------------------------------
