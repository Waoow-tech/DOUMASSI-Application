-- [EXTRA — hors scope E4-12] Nettoyage automatique des stories expirées.
-- Ajouté par précaution pour éviter l'accumulation de fichiers orphelins dans
-- le bucket stories. À toi de valider ou non avant de l'appliquer.
-- Pour l'ignorer : supprime ce fichier uniquement — aucune autre migration n'en dépend.
--
-- Sprint 4 : nettoyage automatique des stories expirées (E4-12)
-- pg_cron toutes les heures : supprime les fichiers Storage puis les lignes DB.
-- Sur Supabase Cloud, supprimer de storage.objects propage la suppression vers S3.
-- La fonction tourne en security definer (accès à storage.objects) ; EXECUTE
-- révoqué sur public pour limiter la surface d'appel.

create or replace function public.cleanup_expired_stories()
returns void
language sql
security definer
set search_path = public
as $$
  -- 1. Supprimer les objets Storage dont la story est expirée
  delete from storage.objects
  where bucket_id = 'stories'
    and name in (
      select split_part(media_url, '/storage/v1/object/public/stories/', 2)
      from public.stories
      where expires_at < now()
        and media_url like '%/storage/v1/object/public/stories/%'
    );

  -- 2. Supprimer les lignes expirées
  delete from public.stories
  where expires_at < now();
$$;

-- Seuls les superusers / pg_cron peuvent appeler cette fonction
revoke execute on function public.cleanup_expired_stories() from public;

-- Planification toutes les heures à H:00 (cron.schedule fait un upsert sur jobname)
select cron.schedule(
  'cleanup-expired-stories',
  '0 * * * *',
  'select public.cleanup_expired_stories()'
);
