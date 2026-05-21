-- Hygiène sécurité : soft_delete_post ne doit pas être appelable
-- directement via REST par les utilisateurs anonymes ou le PUBLIC.
-- Seul `authenticated` doit pouvoir exécuter cette RPC.
--
-- Appliquée via AI Supabase sur dev + staging le 21 mai 2026
-- (migration soft_delete_post_revoke_anon).

revoke execute on function public.soft_delete_post(uuid) from anon, public;