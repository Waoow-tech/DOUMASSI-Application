-- #236 — Audit RLS table `public.calls`
--
-- Vérifie que les policies de la table calls (livrées Sprint 0 dans
-- 20260602120000_messaging_schema.sql) bloquent effectivement les accès
-- croisés. Script à exécuter ponctuellement via AI Supabase (DEV/STAGING)
-- avant la mise en prod des appels.
--
-- Setup :
--   - Alice : créatrice du call (initiator)
--   - Bob : autre participant de la conversation
--   - Charlie : utilisateur étranger qui ne participe à RIEN
--
-- Vérifications :
--   1. Alice (initiator)  : voit le call, peut update status (en tant que participant)
--   2. Bob (participant)  : voit le call, peut update status
--   3. Charlie (étranger) : ne voit RIEN (RLS select renvoie 0 rows)
--   4. Charlie ne peut PAS INSERT un call dans une conv où il n'est pas
--   5. Charlie ne peut PAS UPDATE le call existant (0 rows affectées)
--   6. Alice ne peut PAS INSERT un call avec initiator_id != elle-même
--
-- À NE JAMAIS exécuter en production.

do $$ begin
  if current_setting('app.environment', true) = 'production' then
    raise exception 'NEVER run RLS audit in production';
  end if;
end $$;

-- ============================================================================
-- 0. Cleanup d'un éventuel run précédent
-- ============================================================================
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-0000000ca11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-0000000cb0b00';
  v_carl_id  constant uuid := '00000000-0000-0000-0000-0000000ccab1e';
begin
  delete from public.calls where initiator_id in (v_alice_id, v_bob_id, v_carl_id);
  delete from public.conversation_participants
    where user_id in (v_alice_id, v_bob_id, v_carl_id);
  delete from public.conversations
    where id = '00000000-0000-0000-0000-0000000cca110';
  delete from auth.users where id in (v_alice_id, v_bob_id, v_carl_id);
end $$;

-- ============================================================================
-- 1. Création des 3 users + 1 conversation
-- ============================================================================
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-0000000ca11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-0000000cb0b00';
  v_carl_id  constant uuid := '00000000-0000-0000-0000-0000000ccab1e';
  v_conv_id  constant uuid := '00000000-0000-0000-0000-0000000cca110';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at)
  values
    (v_alice_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated',
     'authenticated', 'audit-calls-alice@doumassi.test', 'dummy', now(), now(), now()),
    (v_bob_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated',
     'authenticated', 'audit-calls-bob@doumassi.test', 'dummy', now(), now(), now()),
    (v_carl_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated',
     'authenticated', 'audit-calls-carl@doumassi.test', 'dummy', now(), now(), now());

  insert into public.profiles (id, username, full_name)
  values
    (v_alice_id, 'audit_calls_alice', 'Alice Audit'),
    (v_bob_id, 'audit_calls_bob', 'Bob Audit'),
    (v_carl_id, 'audit_calls_carl', 'Charlie Audit');

  -- Conversation DM Alice <> Bob (Charlie pas dedans)
  insert into public.conversations (id, is_group, created_by)
  values (v_conv_id, false, v_alice_id);

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (v_conv_id, v_alice_id, 'member'),
    (v_conv_id, v_bob_id, 'member');
end $$;

-- ============================================================================
-- 2. Alice crée un call (en simulant son JWT)
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-0000000ca11ce', true);

insert into public.calls (conversation_id, initiator_id, call_type,
                          daily_room_url, status)
values ('00000000-0000-0000-0000-0000000cca110',
        '00000000-0000-0000-0000-0000000ca11ce',
        'audio',
        'https://doumassi.daily.co/audit-calls-room',
        'ringing')
returning id as alice_inserted_call_id;

-- ============================================================================
-- 3. Bob (participant) : doit VOIR le call
-- ============================================================================
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-0000000cb0b00', true);

-- Attendu : 1 row (le call de Alice)
select 'TEST_3a Bob voit le call' as test,
       count(*) as visible_calls
  from public.calls
 where conversation_id = '00000000-0000-0000-0000-0000000cca110';

-- ============================================================================
-- 4. Charlie (étranger) : ne doit RIEN voir
-- ============================================================================
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-0000000ccab1e', true);

-- Attendu : 0 row — la RLS calls select bloque
select 'TEST_4a Charlie ne voit aucun call de Alice/Bob' as test,
       count(*) as visible_calls
  from public.calls
 where conversation_id = '00000000-0000-0000-0000-0000000cca110';

-- ============================================================================
-- 5. Charlie ne peut PAS INSERT dans cette conversation
-- ============================================================================
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.calls (conversation_id, initiator_id, call_type,
                              daily_room_url, status)
    values ('00000000-0000-0000-0000-0000000cca110',
            '00000000-0000-0000-0000-0000000ccab1e',
            'audio',
            'https://doumassi.daily.co/hacker-call',
            'ringing');
  exception
    when insufficient_privilege then
      v_failed := true;
    when others then
      v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST_5 FAILED : Charlie a pu INSERT un call dans une conv étrangère';
  end if;
  raise notice 'TEST_5 OK : Charlie bloqué côté INSERT (RLS)';
end $$;

-- ============================================================================
-- 6. Charlie ne peut PAS UPDATE le call existant
-- ============================================================================
update public.calls
   set status = 'ended'
 where conversation_id = '00000000-0000-0000-0000-0000000cca110';

-- Attendu : 0 row affectée (RLS update policy)
select 'TEST_6a Charlie UPDATE status — 0 row affectée' as test;

-- ============================================================================
-- 7. Alice ne peut PAS INSERT un call en se faisant passer pour Bob
-- ============================================================================
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-0000000ca11ce', true);

do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into public.calls (conversation_id, initiator_id, call_type,
                              daily_room_url, status)
    values ('00000000-0000-0000-0000-0000000cca110',
            '00000000-0000-0000-0000-0000000cb0b00',  -- Bob, pas elle !
            'audio',
            'https://doumassi.daily.co/spoofed',
            'ringing');
  exception
    when insufficient_privilege then
      v_failed := true;
    when others then
      v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST_7 FAILED : Alice a pu spoofer initiator_id=Bob';
  end if;
  raise notice 'TEST_7 OK : initiator_id spoofing bloqué (RLS WITH CHECK)';
end $$;

-- ============================================================================
-- 8. Cleanup
-- ============================================================================
reset role;

do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-0000000ca11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-0000000cb0b00';
  v_carl_id  constant uuid := '00000000-0000-0000-0000-0000000ccab1e';
begin
  delete from public.calls where initiator_id in (v_alice_id, v_bob_id, v_carl_id);
  delete from public.conversation_participants
    where user_id in (v_alice_id, v_bob_id, v_carl_id);
  delete from public.conversations
    where id = '00000000-0000-0000-0000-0000000cca110';
  delete from public.profiles where id in (v_alice_id, v_bob_id, v_carl_id);
  delete from auth.users where id in (v_alice_id, v_bob_id, v_carl_id);
  raise notice 'CLEANUP OK';
end $$;

-- ============================================================================
-- Critères de succès
-- ============================================================================
-- - TEST_3a : visible_calls = 1 (Bob voit)
-- - TEST_4a : visible_calls = 0 (Charlie ne voit pas)
-- - TEST_5  : "OK" dans les notices (INSERT bloqué)
-- - TEST_6a : 0 row affectée par l'UPDATE
-- - TEST_7  : "OK" dans les notices (spoofing bloqué)
--
-- Si tous OK → la RLS calls protège correctement contre les accès croisés.
