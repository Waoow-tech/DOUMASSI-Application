-- Fix : update_username() doit être idempotent
--
-- Bug remonté pendant le bug bash CTO du 2026-06-05.
--
-- Symptôme observé : un utilisateur qui ouvre l'écran "Éditer mon profil"
-- et modifie un champ AUTRE que son username (bio, avatar, etc.) déclenche
-- parfois l'erreur "You can change your username again on YYYY-MM-DD".
--
-- Cause : la RPC update_username() (migration 20260511150300) vérifie le
-- cooldown 30 jours AVANT de vérifier si le nouveau username est différent
-- de l'actuel. Si le client appelle la RPC avec le même username (cas
-- possible si la comparaison côté client tombe à false négatif — profile
-- null pendant le chargement, normalisation Unicode différente, etc.), la
-- RPC évalue le cooldown et raise.
--
-- Le code client (useEditProfile.ts) a un garde `if (username !== currentUsername)`
-- mais c'est de la défense en profondeur — la RPC doit elle-même être
-- idempotente : si on lui passe le username actuel, NO-OP, pas d'erreur.
--
-- Fix : récupérer username + username_changed_at dans le SELECT initial, et
-- ajouter un EARLY RETURN si lower(current_username) = lower(p_username).
--
-- À appliquer DEV + STAGING via AI Supabase.

create or replace function public.update_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_current_username text;
  v_changed_at timestamptz;
  v_reserved text[] := array[
    'admin', 'administrator', 'root', 'sudo', 'system', 'staff', 'moderator', 'mod',
    'support', 'helpdesk', 'help', 'contact', 'feedback', 'abuse', 'report',
    'api', 'app', 'www', 'mail', 'email', 'null', 'undefined', 'true', 'false',
    'anonymous', 'deleted', 'doumassi', 'doumassiapp', 'doumassi_app',
    'doumassi_official', 'doumassi_team', 'official', 'team',
    'ceo', 'founder', 'owner', 'me', 'you', 'user', 'users', 'guest'
  ];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_username is null or length(v_username) < 3 or length(v_username) > 30 then
    raise exception 'Username must be between 3 and 30 characters';
  end if;

  if v_username !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Username must start with a letter and contain only letters, numbers and underscores';
  end if;

  if right(v_username, 1) = '_' then
    raise exception 'Username cannot end with an underscore';
  end if;

  if v_username ~ '^user_[0-9a-f]{8}$' then
    raise exception 'This username format is reserved';
  end if;

  if v_username = any(v_reserved) then
    raise exception 'This username is reserved';
  end if;

  -- Récupère le username actuel + le timestamp de changement
  select username, username_changed_at
  into v_current_username, v_changed_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  -- IDEMPOTENT : si le username est inchangé, on ne fait rien et on ne
  -- déclenche pas l'erreur cooldown. Permet au client d'appeler la RPC
  -- sans craindre les faux positifs sur la comparaison locale.
  if lower(coalesce(v_current_username, '')) = v_username then
    return;
  end if;

  -- Vérif cooldown SEULEMENT si le username change vraiment
  if v_changed_at is not null and v_changed_at > now() - interval '30 days' then
    raise exception 'You can change your username again on %',
      to_char((v_changed_at + interval '30 days')::date, 'YYYY-MM-DD');
  end if;

  -- Vérif unicité (autre user)
  if exists (
    select 1
    from public.profiles
    where lower(username) = v_username
      and id <> v_user_id
  ) then
    raise exception 'This username is already taken';
  end if;

  -- Update effectif
  update public.profiles
  set
    username = v_username,
    username_changed_at = now(),
    updated_at = now()
  where id = v_user_id;
end;
$$;
