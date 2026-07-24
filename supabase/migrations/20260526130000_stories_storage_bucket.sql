-- Sprint 4 : bucket Storage `stories` + policies (E4-12)
-- Bucket non créé par les migrations précédentes (Sprint 0 n'a pas de trace
-- écrite). Création idempotente : safe si le bucket existe déjà.
-- Accepte images (JPEG/PNG/WebP) et vidéos MP4 jusqu'à 100 Mo.

-- 1. Bucket `stories`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories',
  'stories',
  true,
  104857600, -- 100 Mo max (vidéos 15s)
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
on conflict (id) do update
  set public               = excluded.public,
      file_size_limit      = excluded.file_size_limit,
      allowed_mime_types   = excluded.allowed_mime_types;

-- 2. Policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories users upload own folder'
  ) then
    drop policy if exists "stories users upload own folder" on storage.objects;
    create policy "stories users upload own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'stories'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories users delete own folder'
  ) then
    drop policy if exists "stories users delete own folder" on storage.objects;
    create policy "stories users delete own folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'stories'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'stories public read'
  ) then
    drop policy if exists "stories public read" on storage.objects;
    create policy "stories public read"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'stories');
  end if;
end;
$$;
