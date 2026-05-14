-- Fix : trigger handle_new_user — display_name NOT NULL
--
-- Problème : display_name a une contrainte NOT NULL sur public.profiles,
-- mais le trigger insérait NULL quand les metadata sont vides (ex: users
-- créés directement en SQL pour les tests pgTAP, sans metadata).
--
-- Solution : si meta_display_name est toujours NULL après lecture des
-- metadata, on utilise final_username comme fallback. Ainsi la contrainte
-- NOT NULL est toujours satisfaite, même sans metadata.
--
-- Impacts :
--   - Email signup : meta_display_name = full_name (option B, inchangé)
--   - Google OAuth : meta_display_name = NULL → fallback = username temporaire user_XXXXXXXX
--   - Tests / insertion directe auth.users sans metadata : fallback = username temporaire
--
-- Note : display_name existe toujours en BDD avec NOT NULL mais a été retiré
-- du code applicatif (E3-02). Migration de DROP COLUMN à prévoir plus tard.
-- Pour l'instant, le trigger doit la remplir pour éviter la violation de contrainte.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_username     text;
  meta_display_name text;
  meta_full_name    text;
  meta_birthday     date;
  meta_cgv_at       timestamptz;
  meta_cgv_version  text;
  final_username    text;
  temp_username     text;
  attempt           int := 0;
BEGIN
  meta_username     := trim(NEW.raw_user_meta_data->>'username');
  meta_full_name    := trim(NEW.raw_user_meta_data->>'full_name');
  -- Option B : display_name = full_name en priorité, sinon username en fallback
  meta_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), '')
  );

  BEGIN
    meta_birthday := (NEW.raw_user_meta_data->>'birthday')::date;
  EXCEPTION WHEN others THEN
    meta_birthday := NULL;
  END;

  BEGIN
    meta_cgv_at := (NEW.raw_user_meta_data->>'cgv_accepted_at')::timestamptz;
  EXCEPTION WHEN others THEN
    meta_cgv_at := NULL;
  END;
  meta_cgv_version := NULLIF(trim(NEW.raw_user_meta_data->>'cgv_version'), '');

  -- Choisir le username final
  IF meta_username IS NOT NULL
     AND length(meta_username) >= 3
     AND length(meta_username) <= 30
     AND meta_username ~ '^[a-zA-Z0-9_]+$'
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(meta_username)
    ) THEN
      final_username := meta_username;
    ELSE
      final_username := NULL;
    END IF;
  ELSE
    final_username := NULL;
  END IF;

  -- Générer un username temporaire si nécessaire (cas OAuth Google ou metadata vides)
  IF final_username IS NULL THEN
    LOOP
      temp_username := 'user_' || substring(md5(NEW.id::text || clock_timestamp()::text), 1, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(temp_username)
      );
      attempt := attempt + 1;
      IF attempt >= 5 THEN
        temp_username := 'user_' || replace(NEW.id::text, '-', '');
        EXIT;
      END IF;
    END LOOP;
    final_username := temp_username;
  END IF;

  -- Fallback display_name sur final_username pour satisfaire la contrainte NOT NULL
  -- (cas OAuth sans full_name dans les metadata, ou tests sans metadata)
  IF meta_display_name IS NULL THEN
    meta_display_name := final_username;
  END IF;

  INSERT INTO public.profiles (
    id, username, display_name, full_name, birthday,
    cgv_accepted_at, cgv_version
  )
  VALUES (
    NEW.id,
    final_username,
    meta_display_name,
    NULLIF(meta_full_name, ''),
    meta_birthday,
    meta_cgv_at,
    meta_cgv_version
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Crée un profil après inscription.
   Option B : display_name = full_name (convention sociale standard).
   Fallback display_name = username temporaire si metadata vides (OAuth, tests).
   Email signup : utilise username/full_name/birthday/cgv_* des metadata.
   OAuth (Google) : génère username temporaire user_XXXXXXXX.
   Fix migration — mai 2026';