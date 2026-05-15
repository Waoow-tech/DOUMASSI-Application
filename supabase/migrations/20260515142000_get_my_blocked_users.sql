-- E3-10 — Liste des utilisateurs bloqués par l'utilisateur courant.
--
-- Le client ne peut pas toujours relire directement le profil d'un user bloqué,
-- car les règles RLS le masquent aussi dans les recherches/profils publics.
-- Cette fonction expose uniquement les champs nécessaires à l'écran Settings
-- pour les lignes où auth.uid() est le blocker.

create or replace function public.get_my_blocked_users()
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  is_verified boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    coalesce(p.is_verified, false) as is_verified
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.get_my_blocked_users() from public;
grant execute on function public.get_my_blocked_users() to authenticated;
