-- Tests pgTAP — invariants du wallet Dcoins (E12)
--
-- Lancer avec : supabase test db
-- (nécessite l'extension pgtap + le schéma baseline, cf. docs/rpc-testing-scope.md)
--
-- Couvre le CŒUR TRANSACTIONNEL, là où vit la sécurité de l'argent :
--   • conservation (un transfert somme à zéro)
--   • solde = somme du ledger (invariant fondamental)
--   • solde jamais négatif
--   • idempotence (rejeu de clé = no-op)
--   • garde-fous : auto-crédit interdit, transfert vers soi interdit, helper interne inaccessible
--
-- Rappel : à la création d'un profil, le trigger crée le wallet ET crédite le
-- bonus de bienvenue (100 Dcoins, E12-07). Les fixtures partent donc de 100.

begin;

select plan(12);

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgtap;

-- ─── Fixtures : alice & bob (profils + wallets auto-créés par trigger) ─────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a11ce', 'alice.wallet@test.dev'),
  ('00000000-0000-0000-0000-0000000b0b1e', 'bob.wallet@test.dev');

-- Helpers de session (simulent auth.uid()).
create or replace function _as_alice() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           '{"sub":"00000000-0000-0000-0000-0000000a11ce","role":"authenticated"}', true);
$$;
create or replace function _as_bob() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           '{"sub":"00000000-0000-0000-0000-0000000b0b1e","role":"authenticated"}', true);
$$;
create or replace function _as_service() returns void language sql as $$
  select set_config('role', 'service_role', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Le bonus de bienvenue s'applique en tant que postgres (contexte trigger).
-- On repasse en postgres pour lire les soldes bruts entre les scénarios.
select set_config('role', 'postgres', true);

-- ─── 1. Bonus de bienvenue : chacun démarre à 100 ────────────────────────────
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000a11ce'),
  100::bigint, 'Bonus de bienvenue : alice démarre à 100 Dcoins'
);

-- ─── 2-4. Transfert P2P 30 : alice 70, bob 130, conservation ─────────────────
select _as_alice();
select lives_ok(
  $$ select public.wallet_transfer('00000000-0000-0000-0000-0000000b0b1e', 30, 'trf-1') $$,
  'Transfert 30 Dcoins alice → bob : OK'
);

select set_config('role', 'postgres', true);
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000a11ce'),
  70::bigint, 'Émetteur débité : alice = 70'
);
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000b0b1e'),
  130::bigint, 'Récepteur crédité : bob = 130'
);
select is(
  (select coalesce(sum(amount), 0) from public.wallet_transactions
   where idempotency_key like 'trf-1%'),
  0::bigint, 'Conservation : les 2 legs du transfert se somment à zéro'
);

-- ─── 5. Idempotence transfert : rejouer 'trf-1' ne re-débite pas ─────────────
select _as_alice();
select public.wallet_transfer('00000000-0000-0000-0000-0000000b0b1e', 30, 'trf-1');
select set_config('role', 'postgres', true);
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000a11ce'),
  70::bigint, 'Idempotence : rejeu de la même clé → alice reste à 70'
);

-- ─── 6-7. Dépense (puits) : spend 20 → alice 50 ──────────────────────────────
select _as_alice();
select public.wallet_spend(20, 'spend-1');
select set_config('role', 'postgres', true);
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000a11ce'),
  50::bigint, 'Dépense 20 : alice = 50'
);

-- ─── 8-9. Solde jamais négatif : spend > solde → exception, solde inchangé ────
select _as_alice();
select throws_ok(
  $$ select public.wallet_spend(10000, 'spend-over') $$,
  null, null, 'Solde insuffisant : la dépense au-delà du solde lève une exception'
);
select set_config('role', 'postgres', true);
select is(
  (select balance from public.wallets where user_id = '00000000-0000-0000-0000-0000000a11ce'),
  50::bigint, 'Rollback : après la dépense refusée, alice reste à 50'
);

-- ─── 10. Auto-crédit interdit : authenticated ne peut PAS wallet_grant ────────
select _as_alice();
select throws_ok(
  $$ select public.wallet_grant('00000000-0000-0000-0000-0000000a11ce', 999, 'hack') $$,
  null, null, 'Sécurité : un user authentifié ne peut pas s''auto-créditer (grant = service_role)'
);

-- ─── 11. Transfert vers soi-même interdit ────────────────────────────────────
select _as_alice();
select throws_ok(
  $$ select public.wallet_transfer('00000000-0000-0000-0000-0000000a11ce', 5, 'self-1') $$,
  null, null, 'Transfert vers soi-même : refusé'
);

-- ─── 12. Helper interne _wallet_apply inaccessible à authenticated ───────────
select _as_alice();
select throws_ok(
  $$ select public._wallet_apply(
       '00000000-0000-0000-0000-0000000a11ce', 999, 'grant', 'hack2') $$,
  null, null, 'Sécurité : _wallet_apply (helper interne) inaccessible à authenticated'
);

select * from finish();
rollback;
