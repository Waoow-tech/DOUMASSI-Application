-- E6-01 — Schéma DB messagerie (Pré-bêta 5-12 juin)
--
-- Périmètre fonctionnel : conversations 1-to-1 et groupes, messages texte +
-- pièces jointes (image/voice/video), appels audio/vidéo via Daily.co,
-- soft-delete + édition, réponse à un message, notifications.
--
-- Bêta du 12 juin n'exposera dans l'UI que les conversations 1-to-1 texte,
-- mais l'API et le schéma sont prêts pour groupes / pièces jointes / appels.
-- Aucune migration destructrice ne sera nécessaire pour activer le reste.
--
-- Contenu :
--   - 4 tables : conversations, conversation_participants, messages, calls
--   - 3 enums : message_attachment_type, call_type, call_status
--   - 2 ajouts d'enum existant : 'message' (notification_type), 'conversation' (entity_type)
--   - 4 triggers : update preview on insert, recalcul preview on soft-delete,
--                  notification message, validation 1-to-1 unique
--   - 4 RPCs : get_or_create_dm, create_group_conversation,
--              get_my_conversations, end_call
--   - RLS deny-by-default + 11 policies
--   - Revoke explicite sur les fonctions trigger

-- ============================================================================
-- ENUMS
-- ============================================================================

do $$ begin
  create type public.message_attachment_type as enum ('text', 'image', 'voice', 'video');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.call_type as enum ('audio', 'video');
exception when duplicate_object then null;
end $$;

-- Statuts de cycle de vie d'un appel :
--   ringing : émis, en attente de réponse
--   accepted : décroché, conversation en cours
--   rejected : refusé explicitement par le receveur
--   missed   : non décroché (timeout côté Daily.co ou push manqué)
--   ended    : terminé normalement (raccroché)
--   cancelled: annulé par l'initiateur avant décroché
do $$ begin
  create type public.call_status as enum ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'cancelled');
exception when duplicate_object then null;
end $$;

-- Extension des enums existants (déclenchent un commit implicite par valeur,
-- d'où les blocs séparés)
alter type public.notification_type add value if not exists 'message';
alter type public.entity_type add value if not exists 'conversation';

-- ============================================================================
-- Table conversations
-- ============================================================================
-- Note : les 4 tables messagerie ont été créées vides en Sprint 0 (shell).
-- On utilise CREATE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS pour que la
-- migration soit idempotente sur dev/staging (shell Sprint 0) et sur prod
-- (base vide à venir).
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid()
);

alter table public.conversations add column if not exists is_group boolean not null default false;
alter table public.conversations add column if not exists name text;
alter table public.conversations add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.conversations add column if not exists created_at timestamptz not null default now();
alter table public.conversations add column if not exists last_message_at timestamptz not null default now();
alter table public.conversations add column if not exists last_message_preview text;
alter table public.conversations add column if not exists last_message_sender_id uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.conversations
    add constraint conversations_group_has_name check (
      (is_group = false) or (is_group = true and name is not null and length(trim(name)) > 0)
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_conversations_last_message_at
  on public.conversations (last_message_at desc);

-- ============================================================================
-- Table conversation_participants
-- ============================================================================
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants add column if not exists role text not null default 'member';
alter table public.conversation_participants add column if not exists joined_at timestamptz not null default now();
alter table public.conversation_participants add column if not exists last_read_at timestamptz not null default now();
alter table public.conversation_participants add column if not exists muted_at timestamptz;

do $$ begin
  alter table public.conversation_participants
    add constraint conversation_participants_role_valid check (role in ('admin', 'member'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_conversation_participants_user
  on public.conversation_participants (user_id);

-- ============================================================================
-- Table messages
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade
);

alter table public.messages add column if not exists attachment_type public.message_attachment_type not null default 'text';
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists created_at timestamptz not null default now();
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

do $$ begin
  alter table public.messages
    add constraint messages_text_has_content check (
      deleted_at is not null
      or attachment_type <> 'text'
      or (content is not null and length(content) > 0)
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.messages
    add constraint messages_attachment_has_url check (
      deleted_at is not null
      or attachment_type = 'text'
      or attachment_url is not null
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_messages_sender
  on public.messages (sender_id);

-- ============================================================================
-- Table calls
-- ============================================================================
-- Un appel est toujours rattaché à une conversation (DM ou groupe).
-- Le daily_room_url est créé côté Edge Function au moment de l'INSERT par
-- l'initiateur, puis partagé aux participants via Realtime.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  initiator_id uuid not null references public.profiles(id) on delete cascade
);

-- Sur shells Sprint 0 les colonnes call_type/status n'existent peut-être pas
-- ou ont un autre nom — on les ajoute en mode IF NOT EXISTS.
alter table public.calls add column if not exists call_type public.call_type;
alter table public.calls add column if not exists status public.call_status not null default 'ringing';
alter table public.calls add column if not exists daily_room_url text;
alter table public.calls add column if not exists created_at timestamptz not null default now();
alter table public.calls add column if not exists started_at timestamptz;
alter table public.calls add column if not exists ended_at timestamptz;

-- Une fois la colonne créée, on s'assure du NOT NULL si pas déjà appliqué
do $$ begin
  alter table public.calls alter column call_type set not null;
exception when others then null;
end $$;

do $$ begin
  alter table public.calls
    add constraint calls_started_before_ended check (
      started_at is null or ended_at is null or started_at <= ended_at
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_calls_conversation_created
  on public.calls (conversation_id, created_at desc);

create index if not exists idx_calls_initiator
  on public.calls (initiator_id);

-- ============================================================================
-- Trigger : auto-update conversations.last_message_* sur INSERT message
-- ============================================================================
create or replace function public.fn_update_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Soft-deleted ou édité : ne pas mettre à jour le preview ici
  -- (on a un trigger dédié pour le soft-delete plus bas)
  if NEW.deleted_at is not null then
    return NEW;
  end if;

  update public.conversations
  set last_message_at = NEW.created_at,
      last_message_preview = case
        when NEW.attachment_type = 'text' then left(NEW.content, 100)
        when NEW.attachment_type = 'image' then '📷 Photo'
        when NEW.attachment_type = 'voice' then '🎤 Message vocal'
        when NEW.attachment_type = 'video' then '🎥 Vidéo'
      end,
      last_message_sender_id = NEW.sender_id
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists trg_update_conversation_last_message on public.messages;
create trigger trg_update_conversation_last_message
  after insert on public.messages
  for each row
  execute function public.fn_update_conversation_last_message();

-- ============================================================================
-- Trigger : recalcul du last_message après soft-delete
-- ============================================================================
-- Si le message qu'on soft-delete est le dernier de la conv, il faut recalculer
-- le preview pour ne pas garder le contenu d'un message supprimé. Si ce n'est
-- pas le dernier, ne rien faire.
create or replace function public.fn_recalc_conversation_last_message_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_last boolean;
  v_new_last record;
begin
  -- Ne traite que la transition NULL -> NOT NULL sur deleted_at
  if OLD.deleted_at is not null or NEW.deleted_at is null then
    return NEW;
  end if;

  -- Est-ce que le message supprimé est le dernier de la conv ?
  select (NEW.id = (
    select id from public.messages
    where conversation_id = NEW.conversation_id
      and deleted_at is null
      and id <> NEW.id
    order by created_at desc
    limit 1
  ) is null) into v_was_last;

  -- Quoi qu'il en soit, on recalcule à partir du dernier message non supprimé
  select id, content, attachment_type, sender_id, created_at
  into v_new_last
  from public.messages
  where conversation_id = NEW.conversation_id
    and deleted_at is null
  order by created_at desc
  limit 1;

  if v_new_last.id is null then
    -- Plus aucun message non supprimé dans la conv
    update public.conversations
    set last_message_preview = null,
        last_message_sender_id = null
    where id = NEW.conversation_id;
  else
    update public.conversations
    set last_message_at = v_new_last.created_at,
        last_message_preview = case
          when v_new_last.attachment_type = 'text' then left(v_new_last.content, 100)
          when v_new_last.attachment_type = 'image' then '📷 Photo'
          when v_new_last.attachment_type = 'voice' then '🎤 Message vocal'
          when v_new_last.attachment_type = 'video' then '🎥 Vidéo'
        end,
        last_message_sender_id = v_new_last.sender_id
    where id = NEW.conversation_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_recalc_conv_last_message_on_delete on public.messages;
create trigger trg_recalc_conv_last_message_on_delete
  after update of deleted_at on public.messages
  for each row
  execute function public.fn_recalc_conversation_last_message_on_delete();

-- ============================================================================
-- Trigger : notification à l'INSERT d'un message
-- ============================================================================
-- Notifie tous les participants de la conv sauf le sender. Pour les DM = 1 notif,
-- pour les groupes = N notifs. Idempotent : si le destinataire est en train
-- d'écouter la conv en Realtime, le client peut choisir de ne pas afficher la
-- notif système (logique côté usePushNotificationsHandler).
create or replace function public.fn_notify_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  -- Pas de notif pour les soft-delete ou messages déjà supprimés à l'insertion
  if NEW.deleted_at is not null then
    return NEW;
  end if;

  for v_recipient in
    select user_id from public.conversation_participants
    where conversation_id = NEW.conversation_id
      and user_id <> NEW.sender_id
  loop
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, payload)
    values (
      v_recipient,
      NEW.sender_id,
      'message',
      'conversation',
      NEW.conversation_id,
      jsonb_build_object(
        'message_id', NEW.id,
        'preview', case
          when NEW.attachment_type = 'text' then left(NEW.content, 100)
          when NEW.attachment_type = 'image' then '📷 Photo'
          when NEW.attachment_type = 'voice' then '🎤 Message vocal'
          when NEW.attachment_type = 'video' then '🎥 Vidéo'
        end
      )
    );
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
  after insert on public.messages
  for each row
  execute function public.fn_notify_message();

-- ============================================================================
-- Trigger : empêcher la création d'une 2e conv 1-to-1 entre 2 mêmes users
-- ============================================================================
-- L'unicité au niveau base évite que 2 clients concurrents créent 2 DM
-- séparés entre les mêmes users (race condition que le RPC seul ne couvrirait
-- pas sans verrou explicite).
create or replace function public.fn_enforce_dm_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_group boolean;
  v_other_user uuid;
  v_existing uuid;
begin
  select is_group into v_is_group from public.conversations where id = NEW.conversation_id;
  if v_is_group is true then
    return NEW;
  end if;

  -- DM : on s'assure qu'il n'existe pas déjà une autre DM entre les mêmes 2 users
  -- On regarde les participants déjà présents dans cette conv (autre que celui qu'on ajoute)
  select user_id into v_other_user
  from public.conversation_participants
  where conversation_id = NEW.conversation_id
    and user_id <> NEW.user_id
  limit 1;

  if v_other_user is null then
    return NEW;
  end if;

  -- Cherche une autre conv DM contenant exactement {NEW.user_id, v_other_user}
  select c.id into v_existing
  from public.conversations c
  where c.id <> NEW.conversation_id
    and c.is_group = false
    and exists (select 1 from public.conversation_participants p1
                where p1.conversation_id = c.id and p1.user_id = NEW.user_id)
    and exists (select 1 from public.conversation_participants p2
                where p2.conversation_id = c.id and p2.user_id = v_other_user)
    and (select count(*) from public.conversation_participants p3
         where p3.conversation_id = c.id) = 2
  limit 1;

  if v_existing is not null then
    raise exception 'duplicate DM conversation between % and %', NEW.user_id, v_other_user
      using errcode = '23505';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_dm_uniqueness on public.conversation_participants;
create trigger trg_enforce_dm_uniqueness
  before insert on public.conversation_participants
  for each row
  execute function public.fn_enforce_dm_uniqueness();

-- Hygiène : trigger functions non appelables directement via PostgREST
revoke execute on function public.fn_update_conversation_last_message() from anon, authenticated;
revoke execute on function public.fn_recalc_conversation_last_message_on_delete() from anon, authenticated;
revoke execute on function public.fn_notify_message() from anon, authenticated;
revoke execute on function public.fn_enforce_dm_uniqueness() from anon, authenticated;

-- ============================================================================
-- RLS — deny by default + 11 policies
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;

-- conversations
drop policy if exists "conversations select if participant" on public.conversations;
create policy "conversations select if participant"
  on public.conversations for select
  to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id
      and user_id = (select auth.uid())
  ));

drop policy if exists "conversations update name if admin" on public.conversations;
create policy "conversations update name if admin"
  on public.conversations for update
  to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id
      and user_id = (select auth.uid())
      and role = 'admin'
  ))
  with check (exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id
      and user_id = (select auth.uid())
      and role = 'admin'
  ));

-- conversation_participants
drop policy if exists "conversation_participants select if same conv" on public.conversation_participants;
create policy "conversation_participants select if same conv"
  on public.conversation_participants for select
  to authenticated
  using (exists (
    select 1 from public.conversation_participants me
    where me.conversation_id = conversation_participants.conversation_id
      and me.user_id = (select auth.uid())
  ));

drop policy if exists "conversation_participants update own last_read or muted" on public.conversation_participants;
create policy "conversation_participants update own last_read or muted"
  on public.conversation_participants for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Quitter une conv : on autorise un user à se retirer lui-même
drop policy if exists "conversation_participants delete own" on public.conversation_participants;
create policy "conversation_participants delete own"
  on public.conversation_participants for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- messages
drop policy if exists "messages select if participant" on public.messages;
create policy "messages select if participant"
  on public.messages for select
  to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = messages.conversation_id
      and user_id = (select auth.uid())
  ));

drop policy if exists "messages insert if sender and participant" on public.messages;
create policy "messages insert if sender and participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and user_id = (select auth.uid())
    )
  );

drop policy if exists "messages update own (edit or soft-delete)" on public.messages;
create policy "messages update own (edit or soft-delete)"
  on public.messages for update
  to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- calls
drop policy if exists "calls select if participant of conv" on public.calls;
create policy "calls select if participant of conv"
  on public.calls for select
  to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = calls.conversation_id
      and user_id = (select auth.uid())
  ));

drop policy if exists "calls insert if initiator and participant" on public.calls;
create policy "calls insert if initiator and participant"
  on public.calls for insert
  to authenticated
  with check (
    initiator_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_participants
      where conversation_id = calls.conversation_id
        and user_id = (select auth.uid())
    )
  );

drop policy if exists "calls update status if participant" on public.calls;
create policy "calls update status if participant"
  on public.calls for update
  to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = calls.conversation_id
      and user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.conversation_participants
    where conversation_id = calls.conversation_id
      and user_id = (select auth.uid())
  ));

-- ============================================================================
-- RPC get_or_create_dm — conversation 1-to-1 entre auth.uid() et l'autre user
-- ============================================================================
create or replace function public.get_or_create_dm(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_me = p_other_user_id then
    raise exception 'cannot create DM with self' using errcode = '22023';
  end if;

  -- Garde-fou blocage bilatéral
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_me and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = v_me)
  ) then
    raise exception 'cannot message blocked user' using errcode = '42501';
  end if;

  -- Cherche une DM existante (is_group = false, exactement 2 participants)
  select c.id into v_conv_id
  from public.conversations c
  where c.is_group = false
    and exists (select 1 from public.conversation_participants p1
                where p1.conversation_id = c.id and p1.user_id = v_me)
    and exists (select 1 from public.conversation_participants p2
                where p2.conversation_id = c.id and p2.user_id = p_other_user_id)
    and (select count(*) from public.conversation_participants p3
         where p3.conversation_id = c.id) = 2
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Sinon, on crée
  insert into public.conversations (is_group, created_by)
  values (false, v_me)
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conv_id, v_me, 'admin'),
         (v_conv_id, p_other_user_id, 'admin');

  return v_conv_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- ============================================================================
-- RPC create_group_conversation — pour les groupes (Sprint 6+)
-- ============================================================================
-- Sera exposé Sprint 6 mais déjà fonctionnel. Crée un groupe nommé avec moi
-- comme admin + N membres. Refuse si un des invités a un blocage bilatéral.
create or replace function public.create_group_conversation(
  p_name text,
  p_participant_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv_id uuid;
  v_invited uuid;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'group name required' using errcode = '22023';
  end if;

  if p_participant_ids is null or array_length(p_participant_ids, 1) < 2 then
    raise exception 'group needs at least 2 other participants' using errcode = '22023';
  end if;

  -- Aucun blocage bilatéral toléré dans un groupe
  foreach v_invited in array p_participant_ids loop
    if v_invited = v_me then
      raise exception 'creator cannot be in participant list' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.blocks
      where (blocker_id = v_me and blocked_id = v_invited)
         or (blocker_id = v_invited and blocked_id = v_me)
    ) then
      raise exception 'cannot create group with blocked user %', v_invited using errcode = '42501';
    end if;
  end loop;

  insert into public.conversations (is_group, name, created_by)
  values (true, trim(p_name), v_me)
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conv_id, v_me, 'admin');

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_conv_id, unnest(p_participant_ids), 'member';

  return v_conv_id;
end;
$$;

revoke all on function public.create_group_conversation(text, uuid[]) from public, anon;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- ============================================================================
-- RPC get_my_conversations — liste enrichie pour l'écran liste (E6-02)
-- ============================================================================
-- Retourne toutes mes conversations triées par dernier message desc, avec
-- pour chaque ligne : l'autre participant (DM) ou le nom du groupe, le preview,
-- le compteur non-lus, le timestamp du dernier message.
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
  order by c.last_message_at desc;
end;
$$;

revoke all on function public.get_my_conversations() from public, anon;
grant execute on function public.get_my_conversations() to authenticated;

-- ============================================================================
-- RPC end_call — termine proprement un appel (status + ended_at)
-- ============================================================================
-- À appeler quand l'utilisateur raccroche. Met à jour le status et le ended_at
-- atomiquement. Garde-fou : seul un participant de la conv peut le faire.
create or replace function public.end_call(p_call_id uuid, p_status public.call_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_status not in ('ended', 'rejected', 'missed', 'cancelled') then
    raise exception 'invalid terminal status' using errcode = '22023';
  end if;

  select conversation_id into v_conv_id from public.calls where id = p_call_id;
  if v_conv_id is null then
    raise exception 'call not found' using errcode = '02000';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = v_conv_id and user_id = v_me
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  update public.calls
  set status = p_status,
      ended_at = coalesce(ended_at, now())
  where id = p_call_id
    and status not in ('ended', 'rejected', 'missed', 'cancelled');
end;
$$;

revoke all on function public.end_call(uuid, public.call_status) from public, anon;
grant execute on function public.end_call(uuid, public.call_status) to authenticated;

-- ============================================================================
-- Smoke tests à exécuter manuellement post-application
-- ============================================================================
-- 1. get_or_create_dm(other_id) appelé 2 fois → MÊME id (idempotent)
-- 2. get_or_create_dm(moi) → erreur 22023
-- 3. get_or_create_dm(blocked_user) → erreur 42501
-- 4. Concurrence : 2 sessions appellent get_or_create_dm en même temps avec le
--    même other_id → l'une réussit, l'autre échoue avec 23505 (trigger DM
--    uniqueness) puis sa retry renvoie l'id existant.
-- 5. SELECT messages d'une conv dont je ne suis pas participant → 0 ligne
-- 6. INSERT message avec sender_id != auth.uid() → RLS bloque
-- 7. UPDATE deleted_at sur mon dernier message → preview de la conv recalculé
-- 8. UPDATE deleted_at sur un message ancien → preview inchangé
-- 9. INSERT message → 1 notification créée pour l'autre participant (DM) ou
--    N-1 notifications créées (groupe)
-- 10. create_group_conversation(name, [id1, id2]) → groupe créé avec moi admin
--     + 2 membres
-- 11. end_call(call_id, 'ended') par un non-participant → erreur 42501
-- 12. end_call(call_id, 'ringing') → erreur 22023 (status non terminal)
