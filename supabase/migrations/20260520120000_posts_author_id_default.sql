-- Sprint 3 fix : DEFAULT auth.uid() manquant sur les colonnes owner.
-- posts.author_id / likes.user_id / bookmarks.user_id ont été déployées
-- sans default au Sprint 0. useCreatePost (E4-05) insère volontairement
-- sans author_id → la colonne tombait à NULL → la policy RLS
-- posts_insert_own rejetait l'INSERT ("new row violates row-level
-- security policy for table posts").
-- Appliqué via AI Supabase sur dev + staging le 20 mai 2026.
alter table public.posts     alter column author_id set default auth.uid();
alter table public.likes     alter column user_id   set default auth.uid();
alter table public.bookmarks alter column user_id   set default auth.uid();
