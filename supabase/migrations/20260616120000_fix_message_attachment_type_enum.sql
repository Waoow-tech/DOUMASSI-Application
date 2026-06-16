-- Fix : valeur 'text' manquante sur l'enum message_attachment_type (DEV + STAGING)
--
-- Bug découvert le 2026-06-16 : tout envoi de message texte échoue avec
--   "invalid input value for enum message_attachment_type: \"text\""
-- ce qui fait que public.messages reste vide (count(*) = 0) sur dev ET staging,
-- côté émetteur comme côté destinataire — aucun message n'est jamais persisté.
--
-- Root cause : la création de l'enum dans 20260602120000_messaging_schema.sql
-- est gardée par :
--
--   do $$ begin
--     create type public.message_attachment_type as enum ('text', 'image', 'voice', 'video');
--   exception when duplicate_object then null;
--   end $$;
--
-- Si le type existait déjà (créé par une exécution partielle antérieure de la
-- migration, sans 'text'), le create type lève duplicate_object et le bloc
-- exception l'avale silencieusement : le type existant n'est jamais corrigé,
-- même en ré-appliquant la migration. C'est exactement ce qui s'est produit
-- sur dev et staging.
--
-- Fix : ajouter explicitement la valeur manquante à l'enum existant.
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS est idempotent (Postgres 12+) et ne
-- nécessite pas de bloc exception.

alter type public.message_attachment_type add value if not exists 'text';

-- Vérification post-application (à exécuter manuellement) :
--   select enum_range(null::public.message_attachment_type);
--   → doit retourner {text,image,voice,video}
