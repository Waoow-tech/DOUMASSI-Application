-- Sprint 3 : colonnes feed sur la table posts
alter table public.posts
  add column if not exists media_urls text[] not null default '{}',
  add column if not exists media_type text not null default 'text'
    check (media_type in ('text', 'image', 'video')),
  add column if not exists like_count int not null default 0,
  add column if not exists comment_count int not null default 0,
  add column if not exists share_count int not null default 0,
  add column if not exists bookmark_count int not null default 0,
  add column if not exists view_count int not null default 0;