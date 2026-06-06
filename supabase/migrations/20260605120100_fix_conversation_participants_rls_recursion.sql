-- Fix : récursion infinie sur conversation_participants SELECT policy
--
-- Bug critique découvert le 2026-06-05 pendant l'exécution de l'audit RLS
-- pré-bêta (rls_audit_prebeta.sql / ticket T-04).
--
-- La policy SELECT initiale créée dans PR #192 (20260602120000_messaging_schema.sql) :
--
--   create policy "conversation_participants select if same conv"
--     on public.conversation_participants for select
--     to authenticated
--     using (exists (
--       select 1 from public.conversation_participants me
--       where me.conversation_id = conversation_participants.conversation_id
--         and me.user_id = (select auth.uid())
--     ));
--
-- ... contient une référence à conversation_participants dans son USING. Quand
-- la RLS évalue cette policy pour une row, le sous-SELECT déclenche à son tour
-- l'évaluation de la même policy → récursion infinie → ERROR 42P17
-- « infinite recursion detected in policy for relation "conversation_participants" ».
--
-- Impact : tout client authentifié qui tentait de lire une conversation,
-- récupérer la liste des conversations, ou ouvrir un écran messagerie tombait
-- en erreur. La PR #196 (écran conversation) et #203 (liste conversations)
-- auraient été inutilisables en bêta.
--
-- Fix (pattern recommandé Supabase pour les policies self-referencing) :
--   - Créer une fonction SECURITY DEFINER STABLE `fn_is_conversation_participant`
--     qui lit conversation_participants en bypassant la RLS (SECURITY DEFINER)
--   - Remplacer le subquery récursif par un appel à cette fonction
--
-- La fonction étant SECURITY DEFINER, son SELECT interne ne déclenche pas la
-- policy SELECT de la table → récursion cassée.
--
-- Appliqué DEV + STAGING le 2026-06-05 et audit RLS re-exécuté : 12/12 tests OK.

-- ============================================================================
-- 1. Fonction helper SECURITY DEFINER
-- ============================================================================
create or replace function public.fn_is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

-- Hygiène : fonction appelable depuis les policies (rôles de session) mais pas
-- directement via PostgREST par les clients (pas besoin, c'est un helper interne).
revoke all on function public.fn_is_conversation_participant(uuid) from public, anon;
grant execute on function public.fn_is_conversation_participant(uuid) to authenticated;

-- ============================================================================
-- 2. Remplacement de la policy récursive
-- ============================================================================
drop policy if exists "conversation_participants select if same conv"
  on public.conversation_participants;

create policy "conversation_participants select if same conv"
  on public.conversation_participants for select
  to authenticated
  using (public.fn_is_conversation_participant(conversation_id));

-- ============================================================================
-- Vérification post-application (à exécuter manuellement)
-- ============================================================================
-- 1. select * from public.fn_is_conversation_participant(uuid_d_une_conv_existante);
--    → retourne true si je suis participant, false sinon (sans erreur)
--
-- 2. En tant qu'un user authentifié :
--    select * from public.conversation_participants where conversation_id = '...';
--    → retourne les participants si je suis dans la conv, 0 sinon, jamais d'erreur 42P17
--
-- 3. Réexécuter rls_audit_prebeta.sql → 12/12 tests passent
