-- Sprint 3 hygiène : révoquer l'accès REST direct aux fonctions trigger
-- Ces fonctions sont des triggers internes, pas des RPCs publiques.
-- Elles n'ont pas besoin d'être appelables via /rest/v1/rpc/
-- Migration idempotente (revoke déjà partiellement effectué dans 100002 et 100005)

revoke execute on function public.fn_posts_like_count() from anon, authenticated;
revoke execute on function public.fn_posts_bookmark_count() from anon, authenticated;
revoke execute on function public.fn_posts_comment_count() from anon, authenticated;
revoke execute on function public.fn_notify_follow() from anon, authenticated;
revoke execute on function public.fn_notify_like() from anon, authenticated;
revoke execute on function public.fn_notify_comment() from anon, authenticated;