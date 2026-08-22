-- E5-06 — Bucket des pièces jointes du chat IA (photos).
--
-- PRIVÉ, contrairement aux buckets posts/stories/resources qui sont publics.
-- Ces fichiers sont des photos envoyées à l'assistant (souvent des devoirs de
-- mineurs de 15-17 ans, cf. ADR-008) : elles ne doivent JAMAIS être lisibles
-- par un autre utilisateur ni par anon.
--
-- Conséquence : pour que le modèle Vision puisse voir l'image, l'Edge Function
-- ai-chat génère une URL SIGNÉE à courte durée (le bucket n'est pas public).
-- Et pour réafficher l'image dans l'historique, le client signe aussi à la
-- demande. Aucune URL publique permanente n'existe.
--
-- Chemin : {user_id}/{uuid}.jpg — le 1er segment DOIT être l'auth.uid()
-- (contrôlé par les policies).
--
-- Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-attachments',
  'ai-attachments',
  false,                                   -- PRIVÉ
  10485760,                                -- 10 Mo (photo compressée côté client)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  -- INSERT : l'user upload dans SON dossier.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'ai_attachments users upload own folder'
  ) then
    create policy "ai_attachments users upload own folder"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'ai-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- DELETE : idem sur son dossier.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'ai_attachments users delete own folder'
  ) then
    create policy "ai_attachments users delete own folder"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'ai-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- SELECT : PROPRIÉTAIRE UNIQUEMENT (pas de lecture publique).
  -- C'est la différence clé avec les buckets publics du projet.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'ai_attachments read own folder'
  ) then
    create policy "ai_attachments read own folder"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'ai-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   select public from storage.buckets where id = 'ai-attachments';  -- => false
--   -- un user ne peut lire QUE son propre dossier (SELECT policy)
-- ---------------------------------------------------------------------------
