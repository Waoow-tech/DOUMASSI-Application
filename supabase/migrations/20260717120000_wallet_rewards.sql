-- E12-07 (#338) — Wallet : économie des Dcoins (mécanisme de gains)
--
-- Voir ADR-005 (§4 politique d'émission). Sans ce fichier, personne ne pouvait
-- obtenir de Dcoins → le wallet était une boucle fermée. Ici on branche les
-- ENTRÉES : bonus de bienvenue, publication de cours, réussite de quiz, et
-- connexion quotidienne.
--
-- PRINCIPE ANTI-ABUS : chaque gain est une planche à billets potentielle, donc
-- chacun est IDEMPOTENT via une clé déterministe. Impossible de farmer :
--   - bienvenue        : 'signup:<user>'                → 1× par compte, à vie
--   - publication cours: 'course_publish:<resource>'    → 1× par ressource
--   - réussite quiz     : 'quiz_pass:<quiz>:<user>'      → 1× par (user, quiz)
--   - connexion quot.   : 'daily:<user>:<YYYY-MM-DD>'    → 1× par jour
--
-- Tout passe par `_wallet_apply` (E12-02) : atomique, sous verrou, contrôlé.
-- Les fonctions sont `security definer` (owner postgres) → elles peuvent
-- appeler `_wallet_apply` (revoké au public), et l'idempotence y est gérée.
--
-- Idempotent (migration).

-- ---------------------------------------------------------------------------
-- Barème (montants en Dcoins). Modifiables ici, source unique.
-- ---------------------------------------------------------------------------
--   Bonus de bienvenue ....... 100
--   Publication d'un cours .... 50
--   Réussite d'un quiz ........ 20   (à partir de 70 %)
--   Connexion quotidienne ..... 10
-- Ces valeurs sont inlinées dans les fonctions ci-dessous (plpgsql ne partage
-- pas de constantes entre fonctions). Si tu changes un montant, cherche le
-- commentaire "[BARÈME]".

-- ---------------------------------------------------------------------------
-- Helper interne _wallet_reward — fait entrer une récompense (type 'reward')
-- ---------------------------------------------------------------------------

create or replace function public._wallet_reward(
  p_user            uuid,
  p_amount          bigint,
  p_idempotency_key text,
  p_metadata        jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_amount is null or p_amount <= 0 then
    return null;
  end if;
  -- Le wallet existe toujours (backfill E12-01 + trigger de création). Si par
  -- extraordinaire il manque, _wallet_apply lèvera 'Wallet introuvable' plutôt
  -- que de créditer dans le vide.
  return public._wallet_apply(
    p_user, p_amount, 'reward', p_idempotency_key, null, null, null, p_metadata
  );
end;
$$;

revoke execute on function public._wallet_reward(uuid, bigint, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) Bonus de bienvenue — à la création du profil
-- ---------------------------------------------------------------------------
-- On ENRICHIT le trigger existant (create_wallet_for_new_profile, E12-01) :
-- il crée le wallet PUIS crédite le bonus (ordre important : _wallet_apply
-- verrouille la ligne wallet, qui doit donc déjà exister).

create or replace function public.create_wallet_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  -- [BARÈME] bonus de bienvenue = 100
  perform public._wallet_reward(
    new.id, 100, 'signup:' || new.id::text,
    jsonb_build_object('reason', 'signup_bonus')
  );

  return new;
end;
$$;

-- Backfill : les comptes déjà existants reçoivent aussi le bonus (1× grâce à la
-- clé 'signup:<user>'). Pratique pour que les testeurs actuels aient un solde.
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    -- [BARÈME] bonus de bienvenue = 100
    perform public._wallet_reward(
      r.id, 100, 'signup:' || r.id::text,
      jsonb_build_object('reason', 'signup_bonus')
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Récompense créateur — à la publication d'une ressource (cours)
-- ---------------------------------------------------------------------------

create or replace function public.reward_course_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- [BARÈME] publication d'un cours = 50. Clé par ressource → 1× par ressource.
  perform public._wallet_reward(
    new.author_id, 50, 'course_publish:' || new.id::text,
    jsonb_build_object('reason', 'course_publish', 'resource_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_reward_course_publish on public.resources;
create trigger trg_reward_course_publish
  after insert on public.resources
  for each row execute function public.reward_course_publish();

-- ---------------------------------------------------------------------------
-- 3) Réussite de quiz — à l'enregistrement d'une tentative
-- ---------------------------------------------------------------------------
-- Trigger sur quiz_attempts plutôt que de modifier submit_quiz_attempt : on ne
-- touche pas à la logique de scoring existante. Clé par (quiz, user) → une
-- seule récompense même si l'user repasse le quiz (attempts illimités).

create or replace function public.reward_quiz_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- [BARÈME] seuil de réussite = 70 %, récompense = 20.
  if new.score_pct >= 70 then
    perform public._wallet_reward(
      new.user_id, 20,
      'quiz_pass:' || new.quiz_id::text || ':' || new.user_id::text,
      jsonb_build_object('reason', 'quiz_pass', 'quiz_id', new.quiz_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reward_quiz_pass on public.quiz_attempts;
create trigger trg_reward_quiz_pass
  after insert on public.quiz_attempts
  for each row execute function public.reward_quiz_pass();

-- ---------------------------------------------------------------------------
-- 4) Connexion quotidienne — RPC appelée par le client (1×/jour)
-- ---------------------------------------------------------------------------
-- Contrairement aux 3 précédentes (déclenchées côté serveur), celle-ci est
-- appelée par le client au lancement. Idempotente par jour (clé datée), donc
-- la rappeler plusieurs fois dans la journée ne crédite qu'une fois.
-- Retourne { granted, amount, balance } pour un éventuel toast côté client.

create or replace function public.wallet_claim_daily()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_key      text;
  v_existing bigint;
  v_balance  bigint;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Jour calendaire UTC (cohérent partout ; suffisant pour du MVP).
  v_key := 'daily:' || v_user::text || ':'
           || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');

  -- Déjà réclamé aujourd'hui ?
  select balance_after into v_existing
  from public.wallet_transactions
  where user_id = v_user and idempotency_key = v_key;

  if found then
    select balance into v_balance from public.wallets where user_id = v_user;
    return jsonb_build_object('granted', false, 'amount', 0, 'balance', v_balance);
  end if;

  -- [BARÈME] connexion quotidienne = 10.
  v_balance := public._wallet_reward(
    v_user, 10, v_key, jsonb_build_object('reason', 'daily_login')
  );

  return jsonb_build_object('granted', true, 'amount', 10, 'balance', v_balance);
end;
$$;

grant execute on function public.wallet_claim_daily() to authenticated;
revoke execute on function public.wallet_claim_daily() from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   - Après migration : chaque profil existant a 100 Dcoins (bonus rétro).
--   - Rejouer la migration : soldes inchangés (idempotence signup).
--   - insert dans resources → auteur +50 (une fois par ressource).
--   - insert dans quiz_attempts avec score_pct >= 70 → user +20 (1×/quiz/user).
--   - select public.wallet_claim_daily(); → { granted:true, amount:10, ... }
--     puis un 2e appel le même jour → { granted:false, amount:0, ... }
--   - Invariant : wallets.balance == sum(wallet_transactions.amount) par user.
-- ---------------------------------------------------------------------------
