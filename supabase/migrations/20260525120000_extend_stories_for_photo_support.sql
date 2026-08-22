-- Sprint 4 : support photo + vidéo dans les stories (cf maquette).
-- Le ticket #52 (E4-12) demandait vidéo only mais la maquette montre les 2
-- formats. On aligne sur la maquette : rename video_url → media_url + ajout
-- media_type. duration_seconds rendu nullable (pas pertinent pour les photos).
--
-- Appliquée via AI Supabase sur dev + staging le 25 mai 2026
-- (migration extend_stories_for_photo_support).

alter table public.stories rename column video_url to media_url;

alter table public.stories
  add column if not exists media_type text not null default 'video'
    check (media_type in ('image', 'video'));

alter table public.stories alter column duration_seconds drop not null;