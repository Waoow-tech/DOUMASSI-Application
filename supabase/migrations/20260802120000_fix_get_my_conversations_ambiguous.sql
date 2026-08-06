-- HOTFIX — get_my_conversations plantait : « column reference conversation_id
-- is ambiguous ».
--
-- La fonction RETURNS TABLE(conversation_id uuid, ...) : `conversation_id`
-- est donc une variable de sortie plpgsql. Dans le corps, la sous-requête
-- `... in (select conversation_id from my_convs)` référençait `conversation_id`
-- SANS qualification → Postgres ne sait pas si c'est la colonne du CTE ou la
-- variable de sortie → erreur 42702 à l'exécution → la RPC échoue → l'app
-- affiche « aucune conversation » alors que les données existent.
--
-- Corrections :
--   1. `#variable_conflict use_column` : en cas de conflit nom variable/colonne,
--      plpgsql prend la COLONNE (le comportement voulu ici).
--   2. La référence est qualifiée explicitement (mc.conversation_id) — ceinture
--      + bretelles.
--   3. On en profite pour intégrer le filtre E6-15 (masquer les DM bloqués),
--      qui n'avait jamais été appliqué en base.
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
#variable_conflict use_column
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
      -- Qualification explicite : lève l'ambiguïté conversation_id.
      and cp.conversation_id in (select mc.conversation_id from my_convs mc)
  )
  select
    c.id as conversation_id,
    c.is_group,
    case when c.is_group then c.name else coalesce(p.username, '?') end as display_name,
    case when c.is_group then null else p.avatar_url end as display_avatar_url,
    case when c.is_group then null else ou.other_id end as other_user_id,
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
  -- E6-15 : masquer les DM avec un block (dans un sens OU l'autre). Groupes gardés.
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
-- Post-condition : get_my_conversations() ne plante plus, renvoie mes
-- conversations (DM non bloquées + groupes), plus récente d'abord.
-- ---------------------------------------------------------------------------
