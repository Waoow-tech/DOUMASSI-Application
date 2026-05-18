-- Sprint 3 : RPCs notifications

create or replace function public.get_notifications(
  p_filter text default 'all',
  p_limit int default 30
)
returns table (
  id uuid, recipient_id uuid, actor_id uuid,
  actor_username text, actor_full_name text, actor_avatar_url text, actor_is_verified boolean,
  type text, entity_type text, entity_id uuid, payload jsonb,
  is_seen boolean, is_read boolean, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    n.id, n.recipient_id, n.actor_id,
    pr.username, pr.full_name, pr.avatar_url, coalesce(pr.is_verified, false),
    n.type::text, n.entity_type::text, n.entity_id,
    coalesce(n.payload, n.metadata),
    n.is_seen, n.is_read, n.created_at
  from public.notifications n
  left join public.profiles pr on pr.id = n.actor_id
  where n.recipient_id = auth.uid()
    and case
      when p_filter = 'unread'   then n.is_read = false
      when p_filter = 'social'   then n.type in ('follow', 'follow_request', 'like', 'comment', 'mention')
      when p_filter = 'payment'  then n.type::text = 'payment'
      when p_filter = 'ai'       then n.type::text = 'system'
      else true
    end
  order by n.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_notifications(text, int) to authenticated;

create or replace function public.mark_all_notifications_seen()
returns void language sql security definer set search_path = public as $$
  update public.notifications set is_seen = true
  where recipient_id = auth.uid() and is_seen = false;
$$;

grant execute on function public.mark_all_notifications_seen() to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set is_read = true, is_seen = true
  where id = p_notification_id and recipient_id = auth.uid();
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.count_unread_notifications()
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from public.notifications
  where recipient_id = auth.uid() and is_seen = false;
$$;

grant execute on function public.count_unread_notifications() to authenticated;