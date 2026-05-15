-- Rattrapage : aligner staging sur dev — colonne profiles.is_verified
--
-- Contexte : dev avait depuis longtemps la colonne `is_verified` sur
-- profiles (utilisée par l'écran profil pour le badge bleu). Staging
-- avait divergé — la colonne y était absente.
--
-- Détecté lors de l'application de la migration get_my_blocked_users
-- (E3-10), dont la fonction sélectionne `is_verified` et plantait sur
-- staging.
--
-- Cette migration applique (idempotente via `if not exists`) la colonne
-- manquante. Sur dev elle est no-op puisque déjà présente.
--
-- Note : à terme, la source de vérité doit redevenir le repo via
-- `supabase db push` plutôt que les applications hors-bande. Ce
-- rattrapage est une dette acceptée.

alter table public.profiles
  add column if not exists is_verified boolean not null default false;