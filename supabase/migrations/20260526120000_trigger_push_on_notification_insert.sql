-- Sprint 4 — Trigger push notification sur INSERT dans `notifications`.
--
-- Quand une notification est insérée (via les triggers existants
-- fn_notify_follow / fn_notify_like / fn_notify_comment), ce trigger
-- appelle l'Edge Function `send-push` qui envoie un push Expo au
-- destinataire (récupère son push_token côté profiles, build le message,
-- appelle l'Expo Push API).
--
-- Appliqué via AI Supabase sur dev + staging le 26 mai 2026
-- (migration trigger_push_on_notification_insert).
--
-- ⚠️ URL HARDCODÉE PAR PROJET
-- Le `v_edge_function_url` doit être adapté à chaque environnement :
--   dev     : https://kbysmkhalnolbsojzahf.supabase.co/functions/v1/send-push
--   staging : https://sdapojfdwduhuyduymxk.supabase.co/functions/v1/send-push
--   prod    : <à créer lors du déploiement prod>
-- Lors de l'application sur un nouvel env, REMPLACER `<PROJECT_REF>` ci-
-- dessous par le bon ref avant exécution.
--
-- ⚠️ Dette MVP : `app.settings.service_role_key` n'est pas setté.
-- L'Edge Function tourne en `verify_jwt: false`, donc le `Bearer` envoyé
-- ici peut être vide. Pour la prod, exécuter une fois :
--   alter database postgres set "app.settings.service_role_key" = '<KEY>';

create or replace function public.fn_trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_service_role_key text;
  v_edge_function_url text := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push';
begin
  begin
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  exception when others then
    v_service_role_key := null;
  end;

  perform net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_service_role_key, '')
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  return NEW;
end;
$$;

drop trigger if exists trg_push_on_notification_insert on public.notifications;
create trigger trg_push_on_notification_insert
  after insert on public.notifications
  for each row
  execute function public.fn_trigger_push_notification();

-- Hygiène : trigger function pas appelable via REST
revoke execute on function public.fn_trigger_push_notification() from anon, authenticated;