-- Fix : "column reference \"conversation_id\" is ambiguous" dans get_my_conversations()
--
-- Bug découvert le 2026-06-16 en même temps que le fix de l'enum
-- message_attachment_type (cf. 20260616120000_fix_message_attachment_type_enum.sql).
-- L'écran liste des conversations (E6-02) échoue à chaque appel avec :
--   "column reference \"conversation_id\" is ambiguous"
--
-- Root cause : la fonction déclare `returns table (conversation_id uuid, ...)`,
-- ce qui crée implicitement une variable plpgsql nommée `conversation_id` visible
-- dans tout le corps de la fonction. Dans le CTE `other_user`, la sous-requête :
--
--   and cp.conversation_id in (select conversation_id from my_convs)
--                                      ^^^^^^^^^^^^^^^^ non qualifié
--
-- référence `conversation_id` sans préfixe de table : Postgres ne peut pas
-- distinguer la colonne du CTE `my_convs` de la variable de sortie de la
-- fonction → ambiguïté.
--
-- Fix : qualifier explicitement la colonne (`my_convs.conversation_id`).
-- Reste du corps de la fonction inchangé (toutes les autres références à
-- conversation_id étaient déjà qualifiées : cp.conversation_id, m.conversation_id, etc.)

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
      and cp.conversation_id in (select my_convs.conversation_id from my_convs)
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
  order by c.last_message_at desc;
end;
$$;

-- Hygiène déjà en place (revoke/grant), pas besoin de la répéter ici :
-- la fonction garde les mêmes privilèges (security definer, grant authenticated only).

-- Vérification post-application (à exécuter manuellement, en tant qu'un user authentifié) :
--   select * from public.get_my_conversations();
--   → doit retourner les conversations sans erreur 42702
