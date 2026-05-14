-- Migration E3-08 — RLS profils privés : posts visibles uniquement aux followers acceptés
--
-- Règles de visibilité d'un post (SELECT) :
--   1. Le viewer EST l'auteur            → voit toujours ses propres posts
--   2. Profil public + pas de blocage    → visible par tous
--   3. Profil privé + follow 'accepted'  → visible
--   4. Profil privé + follow 'pending'   → NON visible (demande pas encore acceptée)
--   5. Profil privé + non suivi          → NON visible
--   6. Blocage bilatéral (un sens ou l'autre) → JAMAIS visible
--   7. Viewer non authentifié            → ne voit rien (auth.uid() IS NULL)
--
-- ⚠️ AVANT D'APPLIQUER : confirmer le nom exact de la policy SELECT
-- existante sur public.posts (voir instructions dans la PR). Adapter le
-- DROP POLICY ci-dessous si le nom diffère.

-- ─── Helper : un post de p_author_id est-il visible pour le viewer courant ? ───
-- SECURITY DEFINER : la fonction doit lire blocks/profiles/follows en
-- contournant leur propre RLS pour décider de la visibilité. auth.uid()
-- continue de retourner l'utilisateur courant (lu depuis le JWT).

create or replace function public.can_view_post(p_author_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    -- Viewer non authentifié → rien
    auth.uid() is not null
    and (
      -- 1. Le viewer est l'auteur
      auth.uid() = p_author_id
      or (
        -- 6. Pas de blocage bilatéral
        not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p_author_id)
             or (b.blocker_id = p_author_id and b.blocked_id = auth.uid())
        )
        and (
          -- 2. Profil public
          exists (
            select 1 from public.profiles pr
            where pr.id = p_author_id and pr.is_private = false
          )
          or
          -- 3. Profil privé + follow accepté
          exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followed_id = p_author_id
              and f.status = 'accepted'
          )
        )
      )
    );
$$;

grant execute on function public.can_view_post(uuid) to authenticated;

-- ─── Policy SELECT sur posts ──────────────────────────────────────────────────
-- Remplace la policy existante. Le nom ci-dessous est une hypothèse — à
-- confirmer/adapter selon l'inspection de la base avant application.

drop policy if exists "posts_select_policy" on public.posts;
drop policy if exists "posts are viewable by everyone" on public.posts;
drop policy if exists "Posts are viewable by everyone" on public.posts;
drop policy if exists "posts_select" on public.posts;

create policy "posts_select_visibility"
  on public.posts
  for select
  using (
    deleted_at is null
    and public.can_view_post(author_id)
  );