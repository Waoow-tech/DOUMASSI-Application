-- E4-09 — RPC soft_delete_post : soft delete d'un post par son auteur.
--
-- Pas de policy UPDATE sur public.posts (volontaire) : une policy UPDATE
-- ouvrirait TOUS les champs du post (content, compteurs...) à la modification
-- par l'auteur via REST — trop large. Cette RPC SECURITY DEFINER ne permet
-- QUE le passage de deleted_at, et vérifie author_id = auth.uid() en interne.
--
-- Retourne true si un post a bien été soft-deleted, false sinon (post
-- inexistant, pas l'auteur, ou déjà supprimé).
--
-- Appliquée via AI Supabase sur dev + staging le 21 mai 2026
-- (migration soft_delete_post_rpc).

create or replace function public.soft_delete_post(p_post_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_deleted int;
begin
  update public.posts
  set deleted_at = now()
  where id = p_post_id
    and author_id = auth.uid()
    and deleted_at is null;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

grant execute on function public.soft_delete_post(uuid) to authenticated;