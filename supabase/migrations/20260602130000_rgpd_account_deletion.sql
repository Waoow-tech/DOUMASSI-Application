-- E8-08 — RGPD : suppression de compte avec grace period 30 jours
--
-- Pattern (recommandé par la CNIL) :
--   1. L'user déclenche la suppression depuis Settings (mot de passe requis)
--      → INSERT dans deletion_requests avec scheduled_delete_at = now() + 30j
--      → l'user est immédiatement sign out
--   2. Pendant 30 jours, l'user peut se reconnecter → modal d'annulation
--      → cancel_account_deletion() set cancelled_at = now()
--   3. Passé 30 jours, un job pg_cron quotidien appelle l'Edge Function
--      purge-pending-deletions qui :
--        - supprime tous les fichiers Storage personnels (avatar, cover,
--          stories, etc.) dans les 8 buckets
--        - anonymise le profile (username → deleted_user_<hash>, full_name
--          → NULL, bio → NULL, avatar_url/cover_url → NULL, is_verified → false)
--        - soft-delete tous les messages privés de l'user
--        - place auth.users.email à un placeholder + ban_until = '9999-12-31'
--        - invalide toutes les sessions de l'user
--   4. Les posts, stories, commentaires de l'user RESTENT (pour préserver le
--      contexte des autres users qui ont interagi), mais l'auteur s'affiche
--      comme « Compte supprimé » via le profile anonymisé.
--
-- Contenu :
--   - 1 colonne ajoutée à deletion_requests (processed_at, pour idempotence)
--   - 3 RPCs : request_account_deletion, cancel_account_deletion,
--              get_my_deletion_request
--   - 1 fonction utilitaire SECURITY DEFINER : _anonymize_user_profile
--     (appelée par l'Edge Function purge-pending-deletions via service role)
--   - 1 schedule pg_cron quotidien
--
-- Pré-requis : la table public.deletion_requests existe déjà depuis E3-12
-- (migration 20260516120000_create_deletion_requests.sql).

-- ============================================================================
-- Enrichissement de deletion_requests
-- ============================================================================
-- Idempotence : si la purge a déjà tourné sur une row, on ne la rejoue pas.
alter table public.deletion_requests
  add column if not exists processed_at timestamptz;

-- Index pour le job background : ne pas inclure les rows déjà processed
drop index if exists public.deletion_requests_scheduled_idx;
create index if not exists deletion_requests_scheduled_idx
  on public.deletion_requests (scheduled_delete_at)
  where cancelled_at is null and processed_at is null;

-- ============================================================================
-- RPC request_account_deletion(p_reason text)
-- ============================================================================
-- Garde-fou serveur. Pour la bêta, les hooks client font un INSERT direct sur
-- deletion_requests (RLS le couvre déjà). Cette RPC reste disponible pour
-- évolutions futures (rate limiting, logging, vérifications additionnelles)
-- ou si on veut passer à un appel via Edge Function plus tard.
-- Crée une demande, ou réactive une demande annulée.
create or replace function public.request_account_deletion(p_reason text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_scheduled timestamptz := now() + interval '30 days';
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- INSERT ou UPDATE selon qu'une row existe déjà (l'user a peut-être annulé
  -- puis redemandé). On ne touche pas processed_at.
  insert into public.deletion_requests (user_id, requested_at, reason, scheduled_delete_at, cancelled_at)
  values (v_me, now(), p_reason, v_scheduled, null)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        reason = excluded.reason,
        scheduled_delete_at = excluded.scheduled_delete_at,
        cancelled_at = null;

  return v_scheduled;
end;
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

-- ============================================================================
-- RPC cancel_account_deletion()
-- ============================================================================
-- Appelée quand l'user se reconnecte et accepte d'annuler sa demande.
-- Sans effet si la demande a déjà été processed_at.
create or replace function public.cancel_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_updated boolean;
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.deletion_requests
  set cancelled_at = now()
  where user_id = v_me
    and cancelled_at is null
    and processed_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ============================================================================
-- RPC get_my_deletion_request()
-- ============================================================================
-- Retourne la demande active de l'user (ou NULL). Utilisée au login pour
-- déclencher la modale d'annulation si une demande est en cours.
create or replace function public.get_my_deletion_request()
returns table (
  requested_at timestamptz,
  scheduled_delete_at timestamptz,
  days_remaining integer,
  reason text
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
  select
    dr.requested_at,
    dr.scheduled_delete_at,
    greatest(0, extract(day from dr.scheduled_delete_at - now())::integer) as days_remaining,
    dr.reason
  from public.deletion_requests dr
  where dr.user_id = v_me
    and dr.cancelled_at is null
    and dr.processed_at is null;
end;
$$;

revoke all on function public.get_my_deletion_request() from public, anon;
grant execute on function public.get_my_deletion_request() to authenticated;

-- ============================================================================
-- Fonction _anonymize_user_profile(p_user_id uuid)
-- ============================================================================
-- Appelée par l'Edge Function purge-pending-deletions (service role) après
-- avoir supprimé les fichiers Storage. Effectue 4 opérations atomiques :
--   1. Anonymise le profile (username, full_name, bio, avatar_url, cover_url)
--   2. Soft-delete les messages privés de l'user (deleted_at = now())
--   3. Place auth.users.email à un placeholder déterministe + ban_until permanent
--   4. Marque la deletion_request comme processed
--
-- L'utilisation de auth.users requiert que cette fonction soit appelée avec
-- le rôle postgres (via Edge Function service_role). On ne grant à personne.
create or replace function public._anonymize_user_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short_hash text;
  v_placeholder_email text;
begin
  -- Hash court basé sur l'UUID pour différencier les "Compte supprimé"
  -- (8 caractères suffisent pour ne pas avoir de collision visible)
  v_short_hash := substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_placeholder_email := 'deleted_' || v_short_hash || '@deleted.doumassi.app';

  -- 1. Anonymise le profile
  update public.profiles
  set username = 'deleted_user_' || v_short_hash,
      full_name = null,
      display_name = null,
      bio = null,
      avatar_url = null,
      cover_url = null,
      is_verified = false,
      is_private = true
  where id = p_user_id;

  -- 2. Soft-delete tous les messages privés du user (les autres voient
  --    « Message supprimé »). Les posts/comments/stories restent.
  update public.messages
  set deleted_at = now()
  where sender_id = p_user_id and deleted_at is null;

  -- 3. auth.users : placeholder email + ban permanent + invalidation sessions
  update auth.users
  set email = v_placeholder_email,
      phone = null,
      raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{deleted}',
        'true'
      ),
      banned_until = '9999-12-31 23:59:59+00'::timestamptz
  where id = p_user_id;

  -- 4. Invalide toutes les sessions (force logout si encore actif)
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;

  -- 5. Marque la deletion_request comme processed (idempotence)
  update public.deletion_requests
  set processed_at = now()
  where user_id = p_user_id;
end;
$$;

-- Hygiène : cette fonction n'est jamais appelable via PostgREST (anon/authenticated)
revoke all on function public._anonymize_user_profile(uuid) from public, anon, authenticated;

-- ============================================================================
-- Schedule pg_cron : appel quotidien à l'Edge Function de purge
-- ============================================================================
-- Le job tourne tous les jours à 03:00 UTC. Il appelle via pg_net l'Edge
-- Function purge-pending-deletions qui :
--   1. Liste les deletion_requests expirées (scheduled_delete_at < now,
--      cancelled_at IS NULL, processed_at IS NULL)
--   2. Pour chaque user_id :
--      - Supprime les fichiers Storage personnels dans les 8 buckets
--      - Appelle public._anonymize_user_profile(user_id)

-- Suppression du job précédent s'il existe (idempotence)
do $$ begin
  perform cron.unschedule('purge-pending-deletions-daily');
exception when others then null;
end $$;

-- Reschedule
-- Le secret SUPABASE_SERVICE_ROLE_KEY est à setter via Vault (cf. doc d'ops).
-- Pour l'instant on suppose qu'il est dans vault.decrypted_secrets.
select cron.schedule(
  'purge-pending-deletions-daily',
  '0 3 * * *',  -- tous les jours à 03:00 UTC
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-pending-deletions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ============================================================================
-- Smoke tests à exécuter manuellement post-application
-- ============================================================================
-- 1. request_account_deletion('test') en tant qu'user A → retourne timestamp +30j
--    SELECT * FROM deletion_requests WHERE user_id = A → 1 row, scheduled_delete_at OK
-- 2. cancel_account_deletion() en tant qu'user A → true, cancelled_at NOT NULL
-- 3. get_my_deletion_request() après annulation → 0 row
-- 4. Re-demander la suppression après annulation → row réactivée (cancelled_at NULL)
-- 5. Tenter d'anonymiser depuis le rôle authenticated → erreur (revoke)
-- 6. Appel manuel _anonymize_user_profile(uuid) en tant que postgres → user
--    anonymisé, messages soft-deleted, sessions purgées, ban posé
-- 7. select * from cron.job where jobname = 'purge-pending-deletions-daily'
--    → 1 row, schedule = '0 3 * * *'
