-- T-04 — Audit RLS Pré-bêta 12 juin
--
-- Objectif : valider que la Row Level Security bloque effectivement toute
-- tentative d'accès aux données d'un autre user. Script exécuté ponctuellement
-- via AI Supabase (ou psql avec rôle postgres) avant l'ouverture de la bêta.
--
-- Méthodologie :
--   1. Création de 2 users de test (Alice et Bob) avec données pour chacun
--      (post, story, comment, follow, like, bookmark, block, conversation,
--      message, deletion_request, notification, profile)
--   2. Bascule du rôle vers `authenticated` en simulant le JWT de l'un des 2
--      users via `set_config('request.jwt.claim.sub', user_id, true)`
--   3. Pour chaque table protégée par RLS, on tente :
--        - SELECT croisé (Alice essaye de lire les données de Bob)
--        - INSERT pour le compte de Bob (sender_id/author_id = Bob)
--        - UPDATE des données de Bob
--        - DELETE des données de Bob
--   4. La RLS doit retourner 0 ligne sur les SELECT et lever 42501/insufficient
--      privilege sur les écritures
--
-- Résultats consignés dans `docs/audits/RLS_AUDIT_PREBETA_RESULTS.md`.
--
-- À NE JAMAIS appliquer en production. Ce script crée des users factices et
-- s'exécute uniquement en dev (ou via supabase-cli en local). Le cleanup
-- final supprime tout ce qui a été créé.

-- ============================================================================
-- 0. Hygiène — variables de session
-- ============================================================================
do $$ begin
  if current_setting('app.environment', true) = 'production' then
    raise exception 'NEVER run RLS audit in production';
  end if;
end $$;

-- ============================================================================
-- 1. Création des 2 users factices (auth.users + profile)
-- ============================================================================
-- On utilise des UUIDs déterministes pour rejouer l'audit.
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-00000000b0b00';
begin
  -- Cleanup éventuel d'un précédent run
  delete from auth.users where id in (v_alice_id, v_bob_id);

  -- Insertion auth.users (minimaliste, suffisant pour la RLS)
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (v_alice_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'audit_alice@deleted.doumassi.app', '', now(), now(), now()),
    (v_bob_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'audit_bob@deleted.doumassi.app',   '', now(), now(), now());

  -- Profiles (le trigger handle_new_user les crée normalement, mais on est
  -- explicite ici pour ne pas dépendre de la timing)
  insert into public.profiles (id, username, full_name, bio, is_private, is_verified)
  values
    (v_alice_id, 'audit_alice', 'Alice Audit', 'Test profile Alice', false, false),
    (v_bob_id,   'audit_bob',   'Bob Audit',   'Test profile Bob',   true,  false)
  on conflict (id) do update set username = excluded.username;

  -- Données pour Alice
  insert into public.posts (id, author_id, content, media_type, created_at)
  values ('11111111-1111-1111-1111-111111111111', v_alice_id, 'Post de Alice', 'text', now())
  on conflict (id) do nothing;

  -- Données pour Bob (profil privé)
  insert into public.posts (id, author_id, content, media_type, created_at)
  values ('22222222-2222-2222-2222-222222222222', v_bob_id, 'Post privé de Bob', 'text', now())
  on conflict (id) do nothing;

  -- Une conversation DM Alice <-> Bob avec quelques messages
  insert into public.conversations (id, is_group, created_by)
  values ('33333333-3333-3333-3333-333333333333', false, v_alice_id)
  on conflict (id) do nothing;
  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    ('33333333-3333-3333-3333-333333333333', v_alice_id, 'admin'),
    ('33333333-3333-3333-3333-333333333333', v_bob_id,   'admin')
  on conflict (conversation_id, user_id) do nothing;
  insert into public.messages (conversation_id, sender_id, content)
  values
    ('33333333-3333-3333-3333-333333333333', v_alice_id, 'Hello Bob (depuis Alice)'),
    ('33333333-3333-3333-3333-333333333333', v_bob_id,   'Hello Alice (depuis Bob)')
  on conflict do nothing;
end $$;

-- ============================================================================
-- 2. Helpers : bascule du rôle vers `authenticated` avec un JWT simulé
-- ============================================================================
-- On utilise les fonctions de configuration de session pour simuler la
-- présence d'un JWT avec un user_id donné. C'est le mécanisme utilisé par
-- Supabase pour faire fonctionner `auth.uid()`.

create or replace function public._audit_become(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create or replace function public._audit_reset() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;

-- ============================================================================
-- 3. Tests de contournement
-- ============================================================================
-- Format de sortie : chaque test retourne 1 ligne avec
--   table_name, operation, expected, observed, ok (bool)

-- ----- TEST 3.1 : Alice ne doit PAS pouvoir lire le post privé de Bob -----
-- Bob est en is_private = true et n'a pas accepté Alice → Alice ne suit pas
-- Bob → can_view_post(bob_id) = false côté RLS.
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_count integer;
begin
  perform public._audit_become(v_alice_id);
  select count(*) into v_count from public.posts where author_id = v_bob_id;
  perform public._audit_reset();
  raise notice 'TEST 3.1 posts SELECT cross-user (private profile): expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.2 : Alice ne doit PAS pouvoir INSERT un post au nom de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_passed boolean := false;
begin
  perform public._audit_become(v_alice_id);
  begin
    insert into public.posts (author_id, content, media_type) values (v_bob_id, 'evil', 'text');
    v_passed := true;
  exception when others then
    v_passed := false;
  end;
  perform public._audit_reset();
  -- Cleanup au cas où le test serait passé
  delete from public.posts where author_id = v_bob_id and content = 'evil';
  raise notice 'TEST 3.2 posts INSERT for Bob (with Alice JWT): expected=BLOCKED, observed=%, ok=%',
    case when v_passed then 'PASSED' else 'BLOCKED' end, (not v_passed);
end $$;

-- ----- TEST 3.3 : Alice ne doit PAS pouvoir UPDATE un post de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_count integer;
begin
  perform public._audit_become(v_alice_id);
  update public.posts set content = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_count = row_count;
  perform public._audit_reset();
  raise notice 'TEST 3.3 posts UPDATE other user post: expected=0 rows, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.4 : Alice ne doit PAS pouvoir DELETE un post de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_count integer;
begin
  perform public._audit_become(v_alice_id);
  delete from public.posts where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_count = row_count;
  perform public._audit_reset();
  raise notice 'TEST 3.4 posts DELETE other user post: expected=0 rows, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.5 : Alice ne doit PAS pouvoir lire les messages privés de la
--                 conv où elle n'est PAS participante (création conv Bob seul)
-- (la conv 33333... inclut Alice donc elle peut, on crée une conv Bob-only)
do $$
declare
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_solo_conv constant uuid := '44444444-4444-4444-4444-444444444444';
  v_count integer;
begin
  -- Bob crée une conv solo (techniquement impossible via RPC mais on injecte direct)
  perform public._audit_reset();
  insert into public.conversations (id, is_group, created_by, name)
  values (v_solo_conv, true, v_bob_id, 'Solo Bob')
  on conflict (id) do nothing;
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_solo_conv, v_bob_id, 'admin')
  on conflict do nothing;
  insert into public.messages (conversation_id, sender_id, content)
  values (v_solo_conv, v_bob_id, 'Secret Bob message')
  on conflict do nothing;

  -- Alice essaie de lire
  perform public._audit_become(v_alice_id);
  select count(*) into v_count from public.messages where conversation_id = v_solo_conv;
  perform public._audit_reset();
  raise notice 'TEST 3.5 messages SELECT in conv without me: expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.6 : Alice ne doit PAS pouvoir INSERT un message dans une conv
--                 où elle n'est pas participante
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_passed boolean := false;
begin
  perform public._audit_become(v_alice_id);
  begin
    insert into public.messages (conversation_id, sender_id, content)
    values ('44444444-4444-4444-4444-444444444444', v_alice_id, 'evil intrusion');
    v_passed := true;
  exception when others then
    v_passed := false;
  end;
  perform public._audit_reset();
  delete from public.messages where content = 'evil intrusion';
  raise notice 'TEST 3.6 messages INSERT in conv without me: expected=BLOCKED, observed=%, ok=%',
    case when v_passed then 'PASSED' else 'BLOCKED' end, (not v_passed);
end $$;

-- ----- TEST 3.7 : Alice ne doit PAS pouvoir falsifier sender_id (mettre
--                 sender_id = Bob alors qu'elle envoie le message)
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_passed boolean := false;
begin
  perform public._audit_become(v_alice_id);
  begin
    insert into public.messages (conversation_id, sender_id, content)
    values ('33333333-3333-3333-3333-333333333333', v_bob_id, 'usurped sender');
    v_passed := true;
  exception when others then
    v_passed := false;
  end;
  perform public._audit_reset();
  delete from public.messages where content = 'usurped sender';
  raise notice 'TEST 3.7 messages INSERT with fake sender_id: expected=BLOCKED, observed=%, ok=%',
    case when v_passed then 'PASSED' else 'BLOCKED' end, (not v_passed);
end $$;

-- ----- TEST 3.8 : Alice ne doit PAS pouvoir UPDATE un message de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_msg_id uuid;
  v_count integer;
begin
  -- On récupère un message de Bob existant dans la conv 333
  select id into v_msg_id from public.messages
  where sender_id = v_bob_id and conversation_id = '33333333-3333-3333-3333-333333333333' limit 1;

  perform public._audit_become(v_alice_id);
  update public.messages set content = 'edited by attacker' where id = v_msg_id;
  get diagnostics v_count = row_count;
  perform public._audit_reset();
  raise notice 'TEST 3.8 messages UPDATE other user message: expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.9 : Alice ne doit PAS pouvoir lire la deletion_request de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_count integer;
begin
  -- Bob crée une demande de suppression
  perform public._audit_reset();
  insert into public.deletion_requests (user_id, requested_at, scheduled_delete_at)
  values (v_bob_id, now(), now() + interval '30 days')
  on conflict (user_id) do nothing;

  perform public._audit_become(v_alice_id);
  select count(*) into v_count from public.deletion_requests where user_id = v_bob_id;
  perform public._audit_reset();
  raise notice 'TEST 3.9 deletion_requests SELECT other user: expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.10 : Alice ne doit PAS pouvoir appeler _anonymize_user_profile
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_passed boolean := false;
begin
  perform public._audit_become(v_alice_id);
  begin
    perform public._anonymize_user_profile(v_bob_id);
    v_passed := true;
  exception when others then
    v_passed := false;
  end;
  perform public._audit_reset();
  raise notice 'TEST 3.10 _anonymize_user_profile callable as authenticated: expected=BLOCKED, observed=%, ok=%',
    case when v_passed then 'PASSED' else 'BLOCKED' end, (not v_passed);
end $$;

-- ----- TEST 3.11 : Alice ne doit PAS pouvoir lire les notifications de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_count integer;
begin
  perform public._audit_become(v_alice_id);
  select count(*) into v_count from public.notifications where recipient_id = v_bob_id;
  perform public._audit_reset();
  raise notice 'TEST 3.11 notifications SELECT other user: expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ----- TEST 3.12 : Alice ne doit PAS pouvoir lire les blocks de Bob -----
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id constant uuid := '00000000-0000-0000-0000-00000000b0b00';
  v_count integer;
begin
  perform public._audit_reset();
  insert into public.blocks (blocker_id, blocked_id) values (v_bob_id, v_alice_id) on conflict do nothing;

  perform public._audit_become(v_alice_id);
  select count(*) into v_count from public.blocks where blocker_id = v_bob_id;
  perform public._audit_reset();
  raise notice 'TEST 3.12 blocks SELECT cross-user: expected=0, observed=%, ok=%',
    v_count, (v_count = 0);
end $$;

-- ============================================================================
-- 4. Cleanup — suppression de tous les enregistrements créés pour l'audit
-- ============================================================================
do $$
declare
  v_alice_id constant uuid := '00000000-0000-0000-0000-00000000a11ce';
  v_bob_id   constant uuid := '00000000-0000-0000-0000-00000000b0b00';
begin
  delete from public.messages where conversation_id in
    ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
  delete from public.conversation_participants where conversation_id in
    ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
  delete from public.conversations where id in
    ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
  delete from public.posts where id in
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  delete from public.deletion_requests where user_id in (v_alice_id, v_bob_id);
  delete from public.blocks where blocker_id in (v_alice_id, v_bob_id) or blocked_id in (v_alice_id, v_bob_id);
  delete from auth.users where id in (v_alice_id, v_bob_id);
end $$;

drop function if exists public._audit_become(uuid);
drop function if exists public._audit_reset();

-- ============================================================================
-- Lecture du rapport :
-- - Les RAISE NOTICE remontent dans la sortie SQL.
-- - Tous les `ok=t` doivent être true.
-- - Tout `ok=f` est une faille à corriger AVANT la bêta.
-- ============================================================================
