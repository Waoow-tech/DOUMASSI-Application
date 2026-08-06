-- E6-15 — Masquage bilatéral des conversations en cas de block.
--
-- État avant : bloquer quelqu'un empêchait bien d'ENVOYER un nouveau message
-- (get_or_create_dm lève 'cannot message blocked user'), MAIS la conversation
-- DM existante restait VISIBLE dans la liste des deux côtés — la RPC
-- get_my_conversations ne regardait pas les blocks.
--
-- Fix : on exclut de la liste les DM où un block existe dans un sens OU l'autre.
-- - Bilatéral : la condition teste les deux directions, donc si A bloque B, le
--   DM disparaît pour A (il a bloqué) ET pour B (il a été bloqué).
-- - Les GROUPES ne sont PAS masqués : on ne quitte pas un groupe parce qu'on a
--   bloqué un de ses membres.
--
-- On recrée get_my_conversations à l'identique + le filtre. Même type de retour
-- → create or replace suffit (pas de drop).
--
-- Idempotent.

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  is_group boolean,
  display_name text,
  display_avatar_url text,
  other_user_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count bigint,
  muted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  with my_convs as (
    select cp.conversation_id, cp.last_read_at, cp.muted_at
    from public.conversation_participants cp
    where cp.user_id = v_me
  ),
  other_user as (
    select cp.conversation_id, cp.user_id as other_id
    from public.conversation_participants cp
    where cp.user_id <> v_me
      and cp.conversation_id in (select conversation_id from my_convs)
  )
  select
    c.id as conversation_id,
    c.is_group,
    case
      when c.is_group then c.name
      else coalesce(p.username, '?')
    end as display_name,
    case
      when c.is_group then null
      else p.avatar_url
    end as display_avatar_url,
    case
      when c.is_group then null
      else ou.other_id
    end as other_user_id,
    c.last_message_at,
    c.last_message_preview,
    c.last_message_sender_id,
    (
      select count(*)::bigint
      from public.messages m
      where m.conversation_id = c.id
        and m.created_at > mc.last_read_at
        and m.sender_id <> v_me
        and m.deleted_at is null
    ) as unread_count,
    (mc.muted_at is not null) as muted
  from public.conversations c
  join my_convs mc on mc.conversation_id = c.id
  left join other_user ou on ou.conversation_id = c.id
  left join public.profiles p on p.id = ou.other_id
  -- E6-15 : masquer les DM avec un block (dans un sens OU l'autre). Les groupes
  -- restent toujours visibles.
  where c.is_group
     or not exists (
       select 1 from public.blocks b
       where (b.blocker_id = v_me and b.blocked_id = ou.other_id)
          or (b.blocker_id = ou.other_id and b.blocked_id = v_me)
     )
  order by c.last_message_at desc;
end;
$$;

revoke all on function public.get_my_conversations() from public, anon;
grant execute on function public.get_my_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   -- A et B ont un DM. A bloque B.
--   -- → get_my_conversations() ne renvoie plus ce DM, ni pour A ni pour B.
--   -- Un groupe où A et B sont tous deux membres reste visible pour les deux.
-- ---------------------------------------------------------------------------
