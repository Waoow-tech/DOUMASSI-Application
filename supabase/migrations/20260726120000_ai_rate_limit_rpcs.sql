-- E5-02 — Quota d'usage de l'IA (20 requêtes/jour/utilisateur).
--
-- La table `ai_rate_limits (user_id, day)` existe depuis le Sprint 0 mais
-- n'avait aucune fonction pour l'alimenter. Elle porte une policy SELECT
-- « own » et AUCUNE policy d'écriture : elle n'est donc modifiable que par une
-- fonction `security definer`. C'est voulu — un compteur de quota qu'un client
-- peut écrire n'est pas un quota.
--
-- ⚠️ LE POINT CRITIQUE : L'ATOMICITÉ
--
-- Un « lire le compteur, comparer, puis incrémenter » en trois temps laisse
-- passer plus de requêtes que la limite dès que deux appels arrivent en même
-- temps (l'utilisateur qui tape deux fois, ou une reconnexion qui rejoue). Ici
-- la lecture, la comparaison et l'incrément sont UNE SEULE instruction :
-- le `where` de la clause `on conflict do update` fait la comparaison, et
-- PostgreSQL verrouille la ligne le temps de l'opération.
--
-- Si la limite est atteinte, l'UPDATE ne s'applique pas → `returning` ne
-- renvoie rien → la fonction refuse. Aucune fenêtre de concurrence.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Seuil configurable (même convention que les autres seuils du projet)
-- ---------------------------------------------------------------------------

insert into public.app_config (key, int_value) values
  ('ai_requests_per_day', 20)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Consommation d'une requête
-- ---------------------------------------------------------------------------

create or replace function public.ai_consume_quota()
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_limit integer;
  v_used  integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select int_value into v_limit
  from public.app_config where key = 'ai_requests_per_day';

  -- Pas de seuil configuré → on REFUSE. Contrairement au rate limit des
  -- follows (qui laisse passer par défaut), ici un seuil absent exposerait
  -- une facture ouverte auprès d'un fournisseur payant. On échoue fermé.
  if v_limit is null then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.ai_rate_limits as rl (user_id, day, requests_count)
  values (v_user, current_date, 1)
  on conflict (user_id, day) do update
     set requests_count = rl.requests_count + 1
   where rl.requests_count < v_limit
  returning rl.requests_count into v_used;

  if v_used is null then
    -- L'UPDATE a été bloqué par le `where` : quota déjà atteint.
    return query select false, v_limit, v_limit;
    return;
  end if;

  return query select true, v_used, v_limit;
end;
$$;

grant execute on function public.ai_consume_quota() to authenticated;
revoke execute on function public.ai_consume_quota() from anon, public;

-- ---------------------------------------------------------------------------
-- Consultation du quota restant (pour l'UI, sans rien consommer)
-- ---------------------------------------------------------------------------

create or replace function public.ai_get_quota()
returns table (used integer, quota integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select rl.requests_count
         from public.ai_rate_limits rl
        where rl.user_id = auth.uid() and rl.day = current_date),
      0
    ),
    coalesce((select ac.int_value from public.app_config ac
               where ac.key = 'ai_requests_per_day'), 0);
$$;

grant execute on function public.ai_get_quota() to authenticated;
revoke execute on function public.ai_get_quota() from anon, public;

-- ---------------------------------------------------------------------------
-- Comptabilisation des tokens consommés (appelée après la réponse du modèle)
-- ---------------------------------------------------------------------------
-- Séparée de la consommation du quota : au moment où l'on autorise la requête,
-- on ne sait pas encore combien de tokens elle coûtera. Le compteur de tokens
-- sert au suivi des coûts (E1-15), pas au blocage.

create or replace function public.ai_record_tokens(p_tokens integer)
returns void
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
  if p_tokens is null or p_tokens <= 0 then
    return;
  end if;

  update public.ai_rate_limits
     set tokens_used = tokens_used + p_tokens
   where user_id = v_user and day = current_date;
end;
$$;

grant execute on function public.ai_record_tokens(integer) to authenticated;
revoke execute on function public.ai_record_tokens(integer) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   -- 1) 1er appel de la journée → allowed = true, used = 1
--   select * from public.ai_consume_quota();
--
--   -- 2) Au-delà du seuil → allowed = false, et le compteur NE monte PLUS
--   --    (abaisser temporairement le seuil pour tester) :
--   update public.app_config set int_value = 2 where key = 'ai_requests_per_day';
--   select * from public.ai_consume_quota();   -- allowed = true,  used = 1
--   select * from public.ai_consume_quota();   -- allowed = true,  used = 2
--   select * from public.ai_consume_quota();   -- allowed = false, used = 2
--   select requests_count from public.ai_rate_limits
--    where user_id = auth.uid() and day = current_date;   -- => 2, pas 3
--   update public.app_config set int_value = 20 where key = 'ai_requests_per_day';
--
--   -- 3) Le client ne peut PAS écrire le compteur directement (pas de policy)
--   update public.ai_rate_limits set requests_count = 0;  -- => 0 ligne affectée
--
--   -- 4) anon ne peut pas exécuter
--   --    set role anon; select public.ai_consume_quota();  -- => permission denied
-- ---------------------------------------------------------------------------
