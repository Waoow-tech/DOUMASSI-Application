-- E12-02 (#326) — Wallet : RPC grant / transfer / spend (atomiques, idempotentes)
--
-- Voir ADR-005 §2.2. Dépend de E12-01 (schéma).
--
-- Ces RPC sont le SEUL chemin d'écriture du wallet : la RLS (E12-01) n'expose
-- aucune policy d'écriture, et ces fonctions sont `security definer` (elles
-- contournent donc la RLS — d'où les contrôles explicites ci-dessous).
--
-- Trois garanties, dans cet ordre d'importance :
--
--  1. ATOMICITÉ — ledger + solde sont écrits dans la MÊME transaction. Jamais
--     de ligne de grand livre sans maj du solde, ni l'inverse.
--
--  2. PAS DE RACE / DOUBLE-DÉPENSE — chaque mouvement verrouille la ligne
--     `wallets` (SELECT ... FOR UPDATE) avant de lire le solde. Sans ce verrou,
--     deux dépenses simultanées pourraient toutes deux lire le même solde et
--     passer le contrôle => solde négatif. Le CHECK (balance >= 0) reste le
--     dernier filet, mais on veut une erreur métier propre, pas une violation.
--
--  3. IDEMPOTENCE — un retry réseau ne rejoue pas le mouvement. La vérification
--     se fait SOUS LE VERROU (sinon deux requêtes concurrentes passeraient
--     toutes deux le check avant l'insert).
--
-- Anti-deadlock : `wallet_transfer` verrouille les DEUX wallets dans un ordre
-- déterministe (user_id croissant). Sans ça, A->B et B->A simultanés se
-- bloqueraient mutuellement.
--
-- Idempotent (migration).

-- ---------------------------------------------------------------------------
-- Helper interne _wallet_apply — applique UN mouvement (ledger + solde)
-- ---------------------------------------------------------------------------
-- Non exposé aux clients (revoke plus bas). Suppose que l'appelant a déjà
-- validé les droits ; ce helper ne gère que la mécanique comptable.
-- Retourne le nouveau solde. Si la clé d'idempotence a déjà été utilisée par
-- ce user, ne fait RIEN et retourne le solde enregistré à l'époque.

create or replace function public._wallet_apply(
  p_user           uuid,
  p_amount         bigint,
  p_type           public.wallet_transaction_type,
  p_idempotency_key text,
  p_counterparty   uuid    default null,
  p_reference_type text    default null,
  p_reference_id   uuid    default null,
  p_metadata       jsonb   default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance  bigint;
  v_existing bigint;
begin
  -- 1) Verrou de la ligne wallet : sérialise tous les mouvements de ce user.
  select balance into v_balance
  from public.wallets
  where user_id = p_user
  for update;

  if not found then
    raise exception 'Wallet introuvable pour l''utilisateur %', p_user
      using errcode = 'no_data_found';
  end if;

  -- 2) Idempotence — SOUS le verrou (sinon race entre check et insert).
  select balance_after into v_existing
  from public.wallet_transactions
  where user_id = p_user and idempotency_key = p_idempotency_key;

  if found then
    return v_existing;  -- déjà appliqué : no-op
  end if;

  -- 3) Nouveau solde + contrôle métier.
  v_balance := v_balance + p_amount;

  if v_balance < 0 then
    raise exception 'Solde insuffisant' using errcode = 'check_violation';
  end if;

  -- 4) Ledger (source de vérité) puis solde (cache) — même transaction.
  insert into public.wallet_transactions (
    user_id, amount, type, counterparty_user_id,
    reference_type, reference_id, idempotency_key, balance_after, metadata
  ) values (
    p_user, p_amount, p_type, p_counterparty,
    p_reference_type, p_reference_id, p_idempotency_key, v_balance, p_metadata
  );

  update public.wallets
     set balance = v_balance,
         updated_at = now()
   where user_id = p_user;

  return v_balance;
end;
$$;

-- Helper strictement interne.
revoke execute on function public._wallet_apply(
  uuid, bigint, public.wallet_transaction_type, text, uuid, text, uuid, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- wallet_grant — fait ENTRER des Dcoins dans le système
-- ---------------------------------------------------------------------------
-- Phase 1 : service-role UNIQUEMENT (récompenses / grants admin). Un user ne
-- doit jamais pouvoir se créditer lui-même. L'on-ramp argent réel (topup)
-- viendra en Phase 2 via Edge Function (ADR-006), qui appellera cette RPC avec
-- la service-role key — jamais depuis le client.

create or replace function public.wallet_grant(
  p_user            uuid,
  p_amount          bigint,
  p_idempotency_key text,
  p_type            public.wallet_transaction_type default 'grant',
  p_metadata        jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'p_user requis';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide : doit être > 0';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key requis';
  end if;
  -- Seuls les types "entrée de crédits" sont autorisés ici.
  if p_type not in ('grant', 'reward', 'topup', 'refund', 'adjustment') then
    raise exception 'Type invalide pour un grant : %', p_type;
  end if;

  return public._wallet_apply(
    p_user, p_amount, p_type, p_idempotency_key, null, null, null, p_metadata
  );
end;
$$;

grant execute on function public.wallet_grant(uuid, bigint, text, public.wallet_transaction_type, jsonb)
  to service_role;
revoke execute on function public.wallet_grant(uuid, bigint, text, public.wallet_transaction_type, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- wallet_transfer — P2P et pourboires créateurs
-- ---------------------------------------------------------------------------
-- Écrit DEUX lignes qui se somment à zéro : -X chez l'émetteur, +X chez le
-- récepteur. Les Dcoins sont conservés (aucune création monétaire ici).
-- Retourne le nouveau solde de l'ÉMETTEUR.

create or replace function public.wallet_transfer(
  p_to_user         uuid,
  p_amount          bigint,
  p_idempotency_key text,
  p_is_tip          boolean default false,
  p_reference_type  text    default null,
  p_reference_id    uuid    default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_out_type   public.wallet_transaction_type;
  v_in_type    public.wallet_transaction_type;
  v_new_balance bigint;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_to_user is null then
    raise exception 'Destinataire requis';
  end if;
  if p_to_user = v_user then
    raise exception 'Transfert vers soi-même interdit';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide : doit être > 0';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key requis';
  end if;
  if not exists (select 1 from public.wallets where user_id = p_to_user) then
    raise exception 'Destinataire introuvable';
  end if;

  v_out_type := case when p_is_tip then 'tip_out' else 'transfer_out' end;
  v_in_type  := case when p_is_tip then 'tip_in'  else 'transfer_in'  end;

  -- Verrou des DEUX wallets dans un ordre déterministe (user_id croissant).
  -- Indispensable : sans ça, un transfert A->B concurrent d'un B->A se
  -- bloquerait mutuellement (deadlock).
  -- On verrouille en DEUX ordres explicites plutôt qu'avec un `order by ...
  -- for update` : Postgres ne garantit pas que l'ordre de verrouillage suive
  -- l'ORDER BY selon le plan choisi. Ici l'ordre est non ambigu.
  if v_user < p_to_user then
    perform 1 from public.wallets where user_id = v_user     for update;
    perform 1 from public.wallets where user_id = p_to_user  for update;
  else
    perform 1 from public.wallets where user_id = p_to_user  for update;
    perform 1 from public.wallets where user_id = v_user     for update;
  end if;

  -- Débit émetteur (contrôle de solde + idempotence dans le helper).
  v_new_balance := public._wallet_apply(
    v_user, -p_amount, v_out_type, p_idempotency_key,
    p_to_user, p_reference_type, p_reference_id
  );

  -- Crédit récepteur — même clé d'idempotence : l'unicité est scopée
  -- (user_id, idempotency_key), donc les deux lignes coexistent, et un retry
  -- est neutralisé des deux côtés.
  perform public._wallet_apply(
    p_to_user, p_amount, v_in_type, p_idempotency_key,
    v_user, p_reference_type, p_reference_id
  );

  return v_new_balance;
end;
$$;

grant execute on function public.wallet_transfer(uuid, bigint, text, boolean, text, uuid)
  to authenticated;
revoke execute on function public.wallet_transfer(uuid, bigint, text, boolean, text, uuid)
  from public, anon;

-- ---------------------------------------------------------------------------
-- wallet_spend — dépense sur une feature payante (IA, boost) : le "puits"
-- ---------------------------------------------------------------------------
-- Retire des Dcoins de la circulation (pas de contrepartie utilisateur).
-- Retourne le nouveau solde.

create or replace function public.wallet_spend(
  p_amount          bigint,
  p_idempotency_key text,
  p_reference_type  text default null,
  p_reference_id    uuid default null,
  p_metadata        jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide : doit être > 0';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key requis';
  end if;

  return public._wallet_apply(
    v_user, -p_amount, 'purchase', p_idempotency_key,
    null, p_reference_type, p_reference_id, p_metadata
  );
end;
$$;

grant execute on function public.wallet_spend(bigint, text, text, uuid, jsonb)
  to authenticated;
revoke execute on function public.wallet_spend(bigint, text, text, uuid, jsonb)
  from public, anon;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (à vérifier sur dev) :
--
--   -- 1) Grant (service-role) : crédite
--   select public.wallet_grant('<user>', 100, 'test-grant-1');           -- => 100
--   -- 2) Idempotence : rejouer la MÊME clé ne recrédite pas
--   select public.wallet_grant('<user>', 100, 'test-grant-1');           -- => 100 (no-op)
--   -- 3) Un user authentifié ne peut PAS s'auto-créditer
--   select public.wallet_grant(auth.uid(), 999, 'hack');                 -- => permission denied
--   -- 4) Dépense : débite
--   select public.wallet_spend(30, 'test-spend-1');                      -- => 70
--   -- 5) Solde insuffisant
--   select public.wallet_spend(10000, 'test-spend-2');                   -- => "Solde insuffisant"
--   -- 6) Transfert : 2 lignes qui s'annulent
--   select public.wallet_transfer('<autre_user>', 20, 'test-tr-1');      -- => 50
--   select sum(amount) from public.wallet_transactions
--     where idempotency_key = 'test-tr-1';                               -- => 0 (conservation)
--   -- 7) Transfert vers soi-même
--   select public.wallet_transfer(auth.uid(), 5, 'test-tr-2');           -- => interdit
--   -- 8) Le solde reste égal à la somme du ledger (invariant fondamental)
--   select w.balance = coalesce(sum(t.amount), 0)
--   from public.wallets w
--   left join public.wallet_transactions t on t.user_id = w.user_id
--   where w.user_id = '<user>' group by w.balance;                       -- => true
-- ---------------------------------------------------------------------------
