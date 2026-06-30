-- E7-09 : bucket Storage `listings` + policies
-- Préreq pour E7-14 (Upload images à la création d'annonce)
-- Pattern identique à `posts_storage_bucket` (Sprint 3) et
-- `stories_storage_bucket` (Sprint 4) — voir ces fichiers pour le template.
-- Migration idempotente : ok si le bucket / les policies existent déjà.

-- 1. Bucket `listings`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listings',
  'listings',
  true,
  10485760, -- 10 Mo max par fichier (cohérent posts)
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
      and policyname = 'listings users upload own folder'
  ) then
    create policy "listings users upload own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'listings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Update (replace d'une image lors de l'édition d'une annonce)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listings users update own folder'
  ) then
    create policy "listings users update own folder"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'listings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Delete : l'user peut supprimer ses propres fichiers (cleanup à la suppression
  -- de l'annonce ou retrait d'une image au cours de l'édition)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listings users delete own folder'
  ) then
    create policy "listings users delete own folder"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'listings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Lecture publique : les images d'annonces sont accessibles sans auth
  -- (marketplace visible anon, cohérent avec les RPCs get_listings/get_listing_detail
  -- qui sont aussi grantées à anon).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'listings public read'
  ) then
    create policy "listings public read"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'listings');
  end if;
end;
$$;
