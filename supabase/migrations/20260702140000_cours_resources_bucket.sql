-- E9-03 (#263) — Bucket Storage `resources` + policies
--
-- Stockage des fichiers de ressources pédagogiques (PDF + images). Pattern
-- identique au bucket `listings` (marketplace), en format "phrase" pour les
-- noms de policies (cohérence Sprint 3+, évite les doublons snake_case qu'on
-- a dû nettoyer sur posts/stories/listings).
--
-- Différence avec listings : on autorise application/pdf en plus des images
-- (un cours est souvent un PDF), et une taille max plus généreuse (20 Mo).
--
-- Path attendu côté client : `<user_id>/<uuid>.<ext>` — le 1er segment DOIT
-- être l'auth.uid() (contrôlé par les policies upload/update/delete).
--
-- Idempotent (on conflict + pg_policies check).

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  true,
  20971520, -- 20 Mo
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies (format "phrase", idempotentes)
-- ---------------------------------------------------------------------------

do $$
begin
  -- INSERT : l'user upload dans SON dossier (1er segment = son uid)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'resources users upload own folder'
  ) then
    drop policy if exists "resources users upload own folder" on storage.objects;
    create policy "resources users upload own folder"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'resources'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- UPDATE : idem sur son dossier
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'resources users update own folder'
  ) then
    drop policy if exists "resources users update own folder" on storage.objects;
    create policy "resources users update own folder"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'resources'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- DELETE : idem sur son dossier
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'resources users delete own folder'
  ) then
    drop policy if exists "resources users delete own folder" on storage.objects;
    create policy "resources users delete own folder"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'resources'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- SELECT : lecture publique (bucket public — anon + authenticated)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'resources public read'
  ) then
    drop policy if exists "resources public read" on storage.objects;
    create policy "resources public read"
      on storage.objects for select to anon, authenticated
      using (bucket_id = 'resources');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Post-condition attendue (à vérifier après application) :
--   select policyname, cmd, roles from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and policyname ilike '%resources%'
--   order by policyname;
--
--   → exactement 4 policies "phrase" :
--     - resources users upload own folder   (INSERT, authenticated)
--     - resources users update own folder   (UPDATE, authenticated)
--     - resources users delete own folder   (DELETE, authenticated)
--     - resources public read               (SELECT, {anon, authenticated})
-- ---------------------------------------------------------------------------
