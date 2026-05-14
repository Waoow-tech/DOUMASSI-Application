-- Tests pgTAP — RLS profils privés sur posts (E3-08)
--
-- Lancer avec : supabase test db
-- (nécessite l'extension pgtap : create extension if not exists pgtap;)
--
-- Couvre les 6 scénarios de visibilité de can_view_post / policy posts_select_visibility.

begin;

select plan(7);

-- ─── Fixtures ─────────────────────────────────────────────────────────────────
-- 4 users : alice (public), bob (privé), carol (viewer), dave (bloqué)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a11c', 'alice@test.dev'),
  ('00000000-0000-0000-0000-00000000b0b0', 'bob@test.dev'),
  ('00000000-0000-0000-0000-00000000ca01', 'carol@test.dev'),
  ('00000000-0000-0000-0000-00000000da7e', 'dave@test.dev');

-- Les profils sont créés par le trigger on_auth_user_created ; on force
-- juste les flags is_private nécessaires aux tests.
update public.profiles set is_private = false
  where id = '00000000-0000-0000-0000-00000000a11c'; -- alice publique
update public.profiles set is_private = true
  where id = '00000000-0000-0000-0000-00000000b0b0'; -- bob privé
update public.profiles set is_private = false
  where id = '00000000-0000-0000-0000-00000000da7e'; -- dave public

-- 1 post par auteur (la table posts n'a pas de colonne `type`)
insert into public.posts (id, author_id, image_url) values
  ('00000000-0000-0000-0000-0000000a11c0', '00000000-0000-0000-0000-00000000a11c', 'https://x/a.jpg'),
  ('00000000-0000-0000-0000-0000000b0b00', '00000000-0000-0000-0000-00000000b0b0', 'https://x/b.jpg'),
  ('00000000-0000-0000-0000-0000000da7e0', '00000000-0000-0000-0000-00000000da7e', 'https://x/d.jpg');

-- Blocage bilatéral : dave a bloqué carol
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-00000000da7e', '00000000-0000-0000-0000-00000000ca01');

-- ─── Helper : exécuter en tant que carol ──────────────────────────────────────
create or replace function _as_carol() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           '{"sub":"00000000-0000-0000-0000-00000000ca01","role":"authenticated"}', true);
$$;

create or replace function _as_alice() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           '{"sub":"00000000-0000-0000-0000-00000000a11c","role":"authenticated"}', true);
$$;

-- ─── Scénario 1 : profil public → carol voit le post d'alice ──────────────────
select _as_carol();
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000a11c0'),
  1,
  'Profil public : carol voit le post d''alice'
);

-- ─── Scénario 2 : profil privé non suivi → carol ne voit PAS le post de bob ───
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000b0b00'),
  0,
  'Profil privé non suivi : carol ne voit pas le post de bob'
);

-- ─── Scénario 3 : profil privé suivi 'pending' → toujours invisible ───────────
select set_config('role', 'postgres', true);
insert into public.follows (follower_id, followed_id, status) values
  ('00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000b0b0', 'pending');
select _as_carol();
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000b0b00'),
  0,
  'Profil privé suivi pending : carol ne voit toujours pas le post de bob'
);

-- ─── Scénario 4 : profil privé suivi 'accepted' → visible ────────────────────
select set_config('role', 'postgres', true);
update public.follows set status = 'accepted'
  where follower_id = '00000000-0000-0000-0000-00000000ca01'
    and followed_id = '00000000-0000-0000-0000-00000000b0b0';
select _as_carol();
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000b0b00'),
  1,
  'Profil privé suivi accepted : carol voit le post de bob'
);

-- ─── Scénario 5 : blocage bilatéral → carol ne voit PAS le post de dave ───────
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000da7e0'),
  0,
  'Blocage bilatéral : carol ne voit pas le post de dave (qui l''a bloquée)'
);

-- ─── Scénario 6 : l'auteur voit toujours ses propres posts ───────────────────
select _as_alice();
select is(
  (select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000a11c0'),
  1,
  'Owner : alice voit son propre post'
);

-- ─── Scénario 7 : viewer non authentifié → ne voit rien ──────────────────────
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.posts),
  0,
  'Non authentifié : aucun post visible'
);

select * from finish();
rollback;