-- Cleanup — 13 doublons Sprint 0 sur les tables messagerie
--
-- Contexte : la PR #192 (E6-01 schéma DB messagerie) a ajouté 11 policies E6-01
-- en convention « phrase » sur le rôle `authenticated`, mais 13 anciennes
-- policies Sprint 0 en convention snake_case sur le rôle `public` coexistent.
-- Comme RLS est PERMISSIVE (union des policies), les anciennes laxistes
-- restent actives et masquent le durcissement opéré par les nouvelles.
--
-- Pattern identique à PR #191 (cleanup posts/stories Sprint 0). Audit DEV
-- réalisé par le CTO le 2026-06-02 18:30, croisement avec les policies E6-01
-- effectif post-merge de PR #192.
--
-- Doublons supprimés (13) :
--   calls (3)              : calls_insert_as_initiator, calls_select_participant,
--                            calls_update_participant
--   conversation_participants (4) : cp_delete_own, cp_insert_self_or_participant,
--                                   cp_select_involved, cp_update_own
--   conversations (3)      : conversations_insert_authenticated,
--                            conversations_select_participant,
--                            conversations_update_participant
--   messages (3)           : messages_delete_own, messages_insert_as_sender,
--                            messages_select_participant
--
-- NON remplacés volontairement par des policies E6-01 équivalentes :
--   * conversations INSERT : la création passe exclusivement par les RPCs
--     get_or_create_dm() et create_group_conversation() (SECURITY DEFINER,
--     qui bypassent la RLS). Garder le deny-by-default sur INSERT empêche
--     un client d'insérer directement et force le passage par les RPCs avec
--     leurs garde-fous (blocage bilatéral, anti-self-conv, unicité DM).
--   * messages DELETE : la bêta utilise soft-delete via UPDATE deleted_at
--     (pattern WhatsApp/Telegram). Garder le deny-by-default sur DELETE
--     préserve l'historique pour l'autre participant et l'auditabilité.
--   * conversation_participants INSERT : alimenté uniquement par les RPCs
--     create_dm / create_group (SECURITY DEFINER). Idem deny-by-default.
--
-- Idempotent (drop policy if exists). Aucun impact fonctionnel attendu — RLS
-- PERMISSIVE = union, et les policies E6-01 couvrent déjà les cas légitimes.
-- À appliquer DEV + STAGING via AI Supabase.

-- ----- calls (3 doublons Sprint 0) -----
drop policy if exists "calls_insert_as_initiator" on public.calls;
drop policy if exists "calls_select_participant"  on public.calls;
drop policy if exists "calls_update_participant"  on public.calls;

-- ----- conversation_participants (4 doublons Sprint 0) -----
drop policy if exists "cp_delete_own"                  on public.conversation_participants;
drop policy if exists "cp_insert_self_or_participant"  on public.conversation_participants;
drop policy if exists "cp_select_involved"             on public.conversation_participants;
drop policy if exists "cp_update_own"                  on public.conversation_participants;

-- ----- conversations (3 doublons Sprint 0) -----
drop policy if exists "conversations_insert_authenticated" on public.conversations;
drop policy if exists "conversations_select_participant"   on public.conversations;
drop policy if exists "conversations_update_participant"   on public.conversations;

-- ----- messages (3 doublons Sprint 0) -----
drop policy if exists "messages_delete_own"        on public.messages;
drop policy if exists "messages_insert_as_sender"  on public.messages;
drop policy if exists "messages_select_participant" on public.messages;

-- Post-condition attendue (à vérifier manuellement) :
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('conversations', 'conversation_participants', 'messages', 'calls')
--   order by tablename, policyname;
--
-- Doit retourner exactement 11 policies E6-01 :
--   calls (3)                   : insert if initiator and participant,
--                                 select if participant of conv,
--                                 update status if participant
--   conversation_participants (3) : select if same conv,
--                                   update own last_read or muted,
--                                   delete own
--   conversations (2)           : select if participant,
--                                 update name if admin
--   messages (3)                : insert if sender and participant,
--                                 select if participant,
--                                 update own (edit or soft-delete)
--
-- Toutes en rôle `{authenticated}` (aucune en `{public}` résiduelle).
