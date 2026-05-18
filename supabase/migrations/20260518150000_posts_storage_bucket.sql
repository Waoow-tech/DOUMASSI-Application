-- Sprint 3 : bucket Storage `posts` + policies
-- Préreq pour E4-04 (Upload image vers Supabase Storage)
-- Migration idempotente : ok si le bucket / les policies existent déjà depuis Sprint 0

-- 1. Bucket `posts`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  true,
  10485760, -- 10 Mo max par fichier
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Policies (idempotent via DO block + pg_policies check)
do $$
begin
  -- Upload : l'user authentifié peut écrire uniquement dans son propre dossier {user_id}/
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'posts users upload own folder'
  ) then
    create policy "posts users upload own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'posts'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Update (rare en pratique mais utile si replace)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'posts users update own folder'
  ) then
    create policy "posts users update own folder"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'posts'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Delete : l'user peut supprimer ses propres fichiers (cleanup après suppression de post)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'posts users delete own folder'
  ) then
    create policy "posts users delete own folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'posts'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Lecture publique (les médias de posts sont semi-publics ; la RLS sur public.posts
  -- contrôle déjà qui voit quel post, et personne ne devine une URL avec un UUID)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'posts public read'
  ) then
    create policy "posts public read"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'posts');
  end if;
end;
$$;