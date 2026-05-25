-- Sprint 4 : likes sur les commentaires (cf maquette).
-- Même pattern que posts.like_count + table likes + trigger compteur :
-- une colonne dénormalisée pour l'affichage rapide + table de liaison pour
-- la source de vérité, maintenue cohérente par un trigger.
--
-- Appliquée via AI Supabase sur dev + staging le 25 mai 2026
-- (migration comments_like_count_and_likes_table).

-- Compteur dénormalisé sur comments
alter table public.comments
  add column if not exists like_count int not null default 0;

-- Table de liaison user ↔ comment
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

create policy "comment_likes select all" on public.comment_likes
  for select to authenticated using (true);

create policy "comment_likes insert own" on public.comment_likes
  for insert to authenticated with check (user_id = auth.uid());

create policy "comment_likes delete own" on public.comment_likes
  for delete to authenticated using (user_id = auth.uid());

-- Trigger qui maintient comments.like_count cohérent
create or replace function public.fn_comments_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = NEW.comment_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.comments set like_count = greatest(0, like_count - 1) where id = OLD.comment_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comments_like_count on public.comment_likes;
create trigger trg_comments_like_count
  after insert or delete on public.comment_likes
  for each row execute function public.fn_comments_like_count();

-- Hygiène : trigger function pas appelable via REST
revoke execute on function public.fn_comments_like_count() from anon, authenticated;