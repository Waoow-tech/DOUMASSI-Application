-- Sprint 3 : triggers qui maintiennent les compteurs dénormalisés sur posts

-- like_count
create or replace function public.fn_posts_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.posts set like_count = greatest(0, like_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_posts_like_count on public.likes;
create trigger trg_posts_like_count
  after insert or delete on public.likes
  for each row execute function public.fn_posts_like_count();

-- bookmark_count
create or replace function public.fn_posts_bookmark_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set bookmark_count = bookmark_count + 1 where id = NEW.post_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.posts set bookmark_count = greatest(0, bookmark_count - 1) where id = OLD.post_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_posts_bookmark_count on public.bookmarks;
create trigger trg_posts_bookmark_count
  after insert or delete on public.bookmarks
  for each row execute function public.fn_posts_bookmark_count();

-- comment_count (gère soft delete)
create or replace function public.fn_posts_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
    end if;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      update public.posts set comment_count = greatest(0, comment_count - 1) where id = NEW.post_id;
    elsif OLD.deleted_at is not null and NEW.deleted_at is null then
      update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    if OLD.deleted_at is null then
      update public.posts set comment_count = greatest(0, comment_count - 1) where id = OLD.post_id;
    end if;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_posts_comment_count on public.comments;
create trigger trg_posts_comment_count
  after insert or update or delete on public.comments
  for each row execute function public.fn_posts_comment_count();

-- Backfill initial des compteurs
update public.posts p set
  like_count = (select count(*) from public.likes where post_id = p.id),
  bookmark_count = (select count(*) from public.bookmarks where post_id = p.id),
  comment_count = (select count(*) from public.comments where post_id = p.id and deleted_at is null);

-- Hygiène : trigger functions pas appelables directement via REST
revoke execute on function public.fn_posts_like_count() from anon, authenticated;
revoke execute on function public.fn_posts_bookmark_count() from anon, authenticated;
revoke execute on function public.fn_posts_comment_count() from anon, authenticated;