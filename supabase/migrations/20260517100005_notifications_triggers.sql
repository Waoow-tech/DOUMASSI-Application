-- Sprint 3 : triggers de notifications (follow, like, comment)

create or replace function public.fn_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.follower_id = NEW.followed_id then return NEW; end if;

  if TG_OP = 'INSERT' then
    if NEW.status = 'pending' then
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.followed_id, NEW.follower_id, 'follow_request');
    elsif NEW.status = 'accepted' then
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.followed_id, NEW.follower_id, 'follow');
    end if;
  elsif TG_OP = 'UPDATE' then
    if OLD.status = 'pending' and NEW.status = 'accepted' then
      delete from public.notifications
        where recipient_id = NEW.followed_id
          and actor_id = NEW.follower_id
          and type = 'follow_request';
      insert into public.notifications (recipient_id, actor_id, type)
      values (NEW.follower_id, NEW.followed_id, 'follow');
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow
  after insert or update on public.follows
  for each row execute function public.fn_notify_follow();

create or replace function public.fn_notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
begin
  select author_id into v_post_author from public.posts where id = NEW.post_id;
  if v_post_author is null or v_post_author = NEW.user_id then return NEW; end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  values (v_post_author, NEW.user_id, 'like', 'post', NEW.post_id);
  return NEW;
end;
$$;

drop trigger if exists trg_notify_like on public.likes;
create trigger trg_notify_like
  after insert on public.likes
  for each row execute function public.fn_notify_like();

create or replace function public.fn_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
begin
  if NEW.deleted_at is not null then return NEW; end if;
  select author_id into v_post_author from public.posts where id = NEW.post_id;
  if v_post_author is null or v_post_author = NEW.author_id then return NEW; end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, payload)
  values (v_post_author, NEW.author_id, 'comment', 'post', NEW.post_id,
          jsonb_build_object('preview', left(NEW.content, 100)));
  return NEW;
end;
$$;

drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment
  after insert on public.comments
  for each row execute function public.fn_notify_comment();

-- Hygiène : trigger functions pas appelables directement via REST
revoke execute on function public.fn_notify_follow() from anon, authenticated;
revoke execute on function public.fn_notify_like() from anon, authenticated;
revoke execute on function public.fn_notify_comment() from anon, authenticated;