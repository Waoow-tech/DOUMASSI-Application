-- E12-01 (#325) — Wallet : schéma des Dcoins (monnaie interne)
--
-- Voir ADR-005 (docs/adr/ADR-005-wallet-credits.md).
--
-- Modèle : ledger (grand livre) à 2 tables.
--   - `wallets`              : 1 ligne par user, le solde courant (dénormalisé).
--   - `wallet_transactions`  : le grand livre, append-only, source de vérité.
-- Le solde est reconstituable à tout moment par sum(amount) des transactions :
--   `wallets.balance` n'est qu'un cache maintenu ATOMIQUEMENT par les RPC (E12-02).
--
-- Unité : le Dcoin. Montants en ENTIERS (bigint) — jamais de float (arrondis
-- interdits sur de la monnaie).
--
-- Conservation : un transfert P2P écrit 2 lignes qui se somment à zéro
-- (-X émetteur / +X récepteur). La masse de Dcoins n'augmente que par
-- grant/reward/topup et ne diminue que par les puits (purchase).
--
-- SÉCURITÉ (ADR-005 §2.3) :
--   - RLS deny-by-default : l'user LIT son propre solde/historique, et c'est tout.
--     Aucune policy d'écriture => tout INSERT/UPDATE/DELETE client est refusé.
--   - Les écritures passent exclusivement par les RPC security definer (E12-02).
--   - Solde jamais négatif (CHECK), montants non nuls (CHECK).
--   - Immuabilité du ledger : UPDATE bloqué par trigger (defense-in-depth).
--
-- Ce ticket = SCHÉMA UNIQUEMENT. Les RPC transfer/spend/grant arrivent en E12-02.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Enum des types de transaction
-- ---------------------------------------------------------------------------
-- (pas de `create type if not exists` en Postgres → DO block)
do $$
begin
  create type public.wallet_transaction_type as enum (
    'grant',         -- crédit offert (admin / système)
    'reward',        -- crédit gagné (gamification)
    'topup',         -- crédit acheté en argent réel (Phase 2, ADR-006)
    'transfer_in',   -- reçu d'un autre user (P2P)
    'transfer_out',  -- envoyé à un autre user (P2P)
    'tip_in',        -- pourboire reçu (créateur)
    'tip_out',       -- pourboire envoyé
    'purchase',      -- dépense sur une feature payante (IA, boost) — puits
    'refund',        -- remboursement d'une dépense
    'adjustment'     -- correction manuelle (jamais d'UPDATE : on écrit une ligne)
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Table wallets — solde courant (cache atomique du ledger)
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wallets is
  'E12-01 — Solde Dcoins par user. Cache maintenu atomiquement par les RPC wallet_* ; source de vérité = wallet_transactions.';
comment on column public.wallets.balance is
  'Solde en Dcoins (entier). CHECK >= 0 : ne peut jamais devenir négatif.';

-- ---------------------------------------------------------------------------
-- Table wallet_transactions — le grand livre (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  amount               bigint not null check (amount <> 0),
  type                 public.wallet_transaction_type not null,
  counterparty_user_id uuid references public.profiles(id) on delete set null,
  reference_type       text,          -- ex: 'listing', 'resource', 'boost', 'ai'
  reference_id         uuid,
  idempotency_key      text not null,
  balance_after        bigint not null check (balance_after >= 0),
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

comment on table public.wallet_transactions is
  'E12-01 — Grand livre Dcoins, append-only. amount signé (+ crédit / - débit). Source de vérité du solde.';
comment on column public.wallet_transactions.amount is
  'Montant SIGNÉ en Dcoins : positif = crédit, négatif = débit. Jamais 0.';
comment on column public.wallet_transactions.idempotency_key is
  'Anti double-dépense : un retry réseau réutilise la clé => refusé par l''unique (user_id, idempotency_key).';
comment on column public.wallet_transactions.balance_after is
  'Solde du user APRÈS cette transaction (auditabilité : rejouer le ledger).';

-- Unique PAR USER (et pas global) : un transfert P2P écrit 2 lignes qui partagent
-- la même clé logique (une pour l'émetteur, une pour le récepteur). Le scope par
-- user bloque bien le retry du même user sans casser la double écriture.
create unique index if not exists uq_wallet_transactions_user_idempotency
  on public.wallet_transactions (user_id, idempotency_key);

-- Historique paginé du wallet (écran E12-04).
create index if not exists idx_wallet_transactions_user_created
  on public.wallet_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immuabilité du ledger (defense-in-depth)
-- ---------------------------------------------------------------------------
-- On bloque l'UPDATE : une ligne de grand livre ne se modifie JAMAIS (une
-- correction = une nouvelle ligne de type 'adjustment').
-- On laisse passer le DELETE : la suppression de compte RGPD repose sur le
-- `on delete cascade` depuis profiles (cf. migration rgpd_account_deletion).

create or replace function public.wallet_transactions_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'wallet_transactions est append-only : UPDATE interdit (utiliser une ligne de type adjustment)';
end;
$$;

drop trigger if exists trg_wallet_transactions_no_update on public.wallet_transactions;
create trigger trg_wallet_transactions_no_update
  before update on public.wallet_transactions
  for each row execute function public.wallet_transactions_no_update();

-- ---------------------------------------------------------------------------
-- Création automatique du wallet
-- ---------------------------------------------------------------------------
-- Chaque profil a son wallet dès sa création => les RPC (E12-02) n'ont jamais
-- à gérer le cas "wallet inexistant".

create or replace function public.create_wallet_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_wallet_for_new_profile on public.profiles;
create trigger trg_create_wallet_for_new_profile
  after insert on public.profiles
  for each row execute function public.create_wallet_for_new_profile();

-- Backfill : wallet à 0 Dcoin pour tous les profils existants.
insert into public.wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default
-- ---------------------------------------------------------------------------
-- Seules des policies de SELECT existent => INSERT/UPDATE/DELETE côté client
-- sont refusés. Les RPC (security definer) contournent la RLS, ce qui en fait
-- le SEUL chemin d'écriture.

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "wallets owner read" on public.wallets;
create policy "wallets owner read"
  on public.wallets for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "wallet_transactions owner read" on public.wallet_transactions;
create policy "wallet_transactions owner read"
  on public.wallet_transactions for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Post-conditions attendues :
--   - select * from public.wallets where user_id = auth.uid()  → 1 ligne, balance 0
--   - insert/update direct sur wallets ou wallet_transactions (client) → refusé (RLS)
--   - update d'une ligne de wallet_transactions → exception "append-only"
--   - un nouveau profil → wallet créé automatiquement (trigger)
--   - (user_id, idempotency_key) en double → violation d'unicité
-- ---------------------------------------------------------------------------
