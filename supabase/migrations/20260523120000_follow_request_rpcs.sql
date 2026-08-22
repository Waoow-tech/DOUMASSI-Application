-- E4-17 — RPCs pour gérer les demandes de suivi inline (Accepter / Refuser).
--
-- La RLS de `follows` n'autorise pas le followed_id à UPDATE/DELETE la row
-- pending (seul le follower_id pourrait, ce qui n'a pas de sens ici). Ces
-- RPCs SECURITY DEFINER contournent proprement la RLS, et vérifient elles-
-- mêmes que c'est bien le followed_id courant qui agit (auth.uid()).
--
-- Appliquées via AI Supabase sur dev + staging le 23 mai 2026
-- (migration follow_request_rpcs).

-- ---------------------------------------------------------------------------
-- accept_follow_request : passe le statut pending → accepted.
-- Le trigger trg_notify_follow (cf. 20260517100005_notifications_triggers.sql)
-- se déclenche sur l'UPDATE et :
--   - supprime la notif follow_request reçue par le followed_id
--   - crée la notif follow envoyée au requester (le follower_id)
-- ---------------------------------------------------------------------------

create or replace function public.accept_follow_request(p_requester_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  update public.follows
  set status = 'accepted'
  where follower_id = p_requester_id
    and followed_id = v_me
    and status = 'pending';
end;
$$;

grant execute on function public.accept_follow_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_follow_request : DELETE atomique de la row follows ET de la notif
-- follow_request associée. Le trigger fn_notify_follow ne se déclenche pas
-- sur DELETE, donc le nettoyage de la notif doit être fait ici.
-- ---------------------------------------------------------------------------

create or replace function public.reject_follow_request(p_requester_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;

  delete from public.follows
  where follower_id = p_requester_id
    and followed_id = v_me
    and status = 'pending';

  delete from public.notifications
  where recipient_id = v_me
    and actor_id = p_requester_id
    and type = 'follow_request';
end;
$$;

grant execute on function public.reject_follow_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Hygiène : pas appelables par anon/public (cohérent avec soft_delete_post)
-- ---------------------------------------------------------------------------

revoke execute on function public.accept_follow_request(uuid) from anon, public;
revoke execute on function public.reject_follow_request(uuid) from anon, public;
