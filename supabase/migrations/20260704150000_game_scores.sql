-- E10-01 (#292) — Scores des mini-jeux + classements
--
-- Les jeux sont curatés (registry en dur côté app), donc game_id est un simple
-- text (pas de FK vers une table de jeux). Un score = une partie. Le meilleur
-- score par (user, jeu) est dérivé (max), comme pour le quiz Cours.
--
-- Note sécurité : le score vient du JS du jeu (WebView) → potentiellement
-- falsifiable. Acceptable pour du fun MVP (pas d'enjeu monétaire). Si besoin,
-- on ajoutera des bornes de plausibilité dans submit_game_score.
--
-- Idempotent.

create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null,
  score      int  not null,
  created_at timestamptz not null default now()
);

comment on table public.game_scores is
  'E10-01 — Scores des mini-jeux (game_id = id du registry app). Meilleur score dérivé.';

create index if not exists idx_game_scores_game_score
  on public.game_scores (game_id, score desc);
create index if not exists idx_game_scores_user_game
  on public.game_scores (user_id, game_id);

alter table public.game_scores enable row level security;

-- Lecture publique (classements visibles par tous). Écriture via RPC.
drop policy if exists "game_scores public read" on public.game_scores;
create policy "game_scores public read"
  on public.game_scores for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- RPC submit_game_score — enregistre une partie (owner forcé)
-- ---------------------------------------------------------------------------

create or replace function public.submit_game_score(p_game_id text, p_score int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_score is null or p_score < 0 then raise exception 'Invalid score'; end if;

  insert into public.game_scores (user_id, game_id, score)
  values (v_user, p_game_id, p_score);

  -- Retourne le meilleur score de l'user sur ce jeu (après insertion).
  return (
    select max(score) from public.game_scores
    where user_id = v_user and game_id = p_game_id
  );
end;
$$;

grant execute on function public.submit_game_score(text, int) to authenticated;
revoke execute on function public.submit_game_score(text, int) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_my_best_game_score — meilleur score perso (ou null)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_best_game_score(p_game_id text)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select max(score)
  from public.game_scores
  where game_id = p_game_id and user_id = auth.uid();
$$;

grant execute on function public.get_my_best_game_score(text) to authenticated;
revoke execute on function public.get_my_best_game_score(text) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_game_leaderboard — top N (meilleur score par user)
-- ---------------------------------------------------------------------------

create or replace function public.get_game_leaderboard(p_game_id text, p_limit int default 20)
returns table (
  user_id     uuid,
  username    text,
  avatar_url  text,
  is_verified boolean,
  best_score  int,
  is_me       boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    mx.user_id,
    p.username,
    p.avatar_url,
    coalesce(p.is_verified, false),
    mx.best_score,
    (mx.user_id = auth.uid()) as is_me
  from (
    select user_id, max(score) as best_score
    from public.game_scores
    where game_id = p_game_id
    group by user_id
  ) mx
  join public.profiles p on p.id = mx.user_id
  order by mx.best_score desc, mx.user_id
  limit p_limit;
$$;

grant execute on function public.get_game_leaderboard(text, int) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Post-conditions :
--   - submit_game_score('2048', 1200) → retourne le meilleur score (>= 1200)
--   - get_my_best_game_score('2048') → 1200
--   - get_game_leaderboard('2048', 10) → lignes triées par best_score desc
-- ---------------------------------------------------------------------------
