alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create or replace function public.update_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(trim(p_username));
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

  select username_changed_at
  into v_changed_at
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_changed_at is not null and v_changed_at > now() - interval '30 days' then
    raise exception 'You can change your username again on %',
      to_char((v_changed_at + interval '30 days')::date, 'YYYY-MM-DD');
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(username) = v_username
      and id <> v_user_id
  ) then
    raise exception 'This username is already taken';
  end if;

  update public.profiles
  set
    username = v_username,
    username_changed_at = now(),
    updated_at = now()
  where id = v_user_id;
end;
$$;

grant execute on function public.update_username(text) to authenticated;
