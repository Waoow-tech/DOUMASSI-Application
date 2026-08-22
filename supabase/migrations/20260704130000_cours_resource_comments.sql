-- E9-16 (#276) — Commentaires / entraide sous ressources
--
-- Table DÉDIÉE resource_comments (cf brief §15.2 : le `comments` existant est
-- couplé aux posts, on ne le réutilise pas). Accès direct client via RLS
-- (pas de RPC) : lecture publique, écriture de son propre commentaire,
-- suppression de son commentaire OU par l'auteur de la ressource (modération).
--
-- Idempotent.

create table if not exists public.resource_comments (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);

comment on table public.resource_comments is
  'E9-16 — Commentaires/entraide sous les ressources Cours (table dédiée).';

create index if not exists idx_resource_comments_resource
  on public.resource_comments (resource_id, created_at desc);

alter table public.resource_comments enable row level security;

-- Lecture publique (les commentaires sont visibles par tous).
drop policy if exists "resource_comments public read" on public.resource_comments;
create policy "resource_comments public read"
  on public.resource_comments for select to anon, authenticated using (true);

-- Écriture : chacun poste sous son propre nom.
drop policy if exists "resource_comments insert own" on public.resource_comments;
create policy "resource_comments insert own"
  on public.resource_comments for insert to authenticated
  with check (author_id = auth.uid());

-- Suppression : l'auteur du commentaire OU l'auteur de la ressource
-- (modération de sa propre ressource).
drop policy if exists "resource_comments delete own or resource owner" on public.resource_comments;
create policy "resource_comments delete own or resource owner"
  on public.resource_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.resources r
      where r.id = resource_id and r.author_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Post-conditions :
--   - insert d'un commentaire avec author_id = moi → OK
--   - insert avec author_id d'un autre → refusé
--   - delete de mon commentaire → OK ; delete d'un commentaire sur MA
--     ressource (posté par un autre) → OK ; sinon → refusé
--   - select public → visible par anon
-- ---------------------------------------------------------------------------
