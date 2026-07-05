-- E9-10 (#270) — Modèle de données Quiz + RPCs
--
-- Un quiz = liste de questions (QCM à choix unique/multiple, ou vrai/faux),
-- optionnellement rattaché à une ressource. Cf brief §7.
--
-- Principe anti-triche : les bonnes réponses (quiz_options.is_correct) ne sont
-- JAMAIS exposées au client. La lecture pour jouer passe par get_quiz (qui
-- omet is_correct) et le calcul du score se fait entièrement côté serveur dans
-- submit_quiz_attempt. Les tables quiz_questions / quiz_options ont donc RLS
-- deny-all (aucune policy) — tout passe par les RPCs security definer.
--
-- Comportement décidé (brief §15.5) : tentatives illimitées, meilleur score
-- affiché, pas de limite quotidienne. Score calculé serveur (non trichable).
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  -- Rattachement optionnel à une ressource (un quiz peut être autonome).
  resource_id    uuid references public.resources(id) on delete set null,
  level_code     text not null references public.course_levels(code),
  subject_code   text not null references public.course_subjects(code),
  title          text not null,
  question_count int  not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.quizzes is 'E9-10 — Quiz (QCM/vrai-faux), optionnellement lié à une ressource.';

create index if not exists idx_quizzes_resource on public.quizzes (resource_id);
create index if not exists idx_quizzes_level_subject on public.quizzes (level_code, subject_code);

create table if not exists public.quiz_questions (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references public.quizzes(id) on delete cascade,
  position int  not null,
  prompt   text not null,
  -- single = 1 bonne réponse (radio) ; multiple = 1+ (cases) ; boolean = vrai/faux
  type     text not null check (type in ('single', 'multiple', 'boolean'))
);

create index if not exists idx_quiz_questions_quiz on public.quiz_questions (quiz_id, position);

create table if not exists public.quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  position    int  not null,
  label       text not null,
  is_correct  boolean not null default false
);

create index if not exists idx_quiz_options_question on public.quiz_options (question_id, position);

create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  score_pct     int  not null,
  correct_count int  not null,
  total_count   int  not null,
  completed_at  timestamptz not null default now()
);

create index if not exists idx_quiz_attempts_user_quiz on public.quiz_attempts (user_id, quiz_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options   enable row level security;
alter table public.quiz_attempts  enable row level security;

-- quizzes : lecture publique de la méta (titre, rattachement). Écriture via
-- RPC create_quiz uniquement (aucune policy write).
drop policy if exists "quizzes public read" on public.quizzes;
create policy "quizzes public read"
  on public.quizzes for select to anon, authenticated using (true);

-- quiz_questions / quiz_options : DENY-ALL client (aucune policy). Lecture via
-- get_quiz (sans is_correct), écriture via create_quiz. Protège les réponses.

-- quiz_attempts : l'user lit ses propres tentatives (historique). Insertion
-- via submit_quiz_attempt uniquement.
drop policy if exists "quiz_attempts select own" on public.quiz_attempts;
create policy "quiz_attempts select own"
  on public.quiz_attempts for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC create_quiz — création imbriquée (questions + options) en un appel
-- p_questions : jsonb array de
--   { "prompt": text, "type": "single|multiple|boolean",
--     "options": [ { "label": text, "is_correct": bool }, ... ] }
-- ---------------------------------------------------------------------------

create or replace function public.create_quiz(
  p_title        text,
  p_level_code   text,
  p_subject_code text,
  p_questions    jsonb,
  p_resource_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_quiz      uuid;
  v_q         jsonb;
  v_qid       uuid;
  v_opt       jsonb;
  v_qpos      int := 0;
  v_opos      int;
  v_has_correct boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_questions is null or jsonb_array_length(p_questions) < 1 then
    raise exception 'Quiz must have at least 1 question';
  end if;

  insert into public.quizzes (author_id, resource_id, level_code, subject_code, title)
  values (v_user, p_resource_id, p_level_code, p_subject_code, p_title)
  returning id into v_quiz;

  for v_q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_array_length(v_q->'options') < 2 then
      raise exception 'Each question needs at least 2 options';
    end if;

    insert into public.quiz_questions (quiz_id, position, prompt, type)
    values (v_quiz, v_qpos, v_q->>'prompt', coalesce(v_q->>'type', 'single'))
    returning id into v_qid;

    v_opos := 0;
    v_has_correct := false;
    for v_opt in select value from jsonb_array_elements(v_q->'options') loop
      insert into public.quiz_options (question_id, position, label, is_correct)
      values (
        v_qid,
        v_opos,
        v_opt->>'label',
        coalesce((v_opt->>'is_correct')::boolean, false)
      );
      if coalesce((v_opt->>'is_correct')::boolean, false) then
        v_has_correct := true;
      end if;
      v_opos := v_opos + 1;
    end loop;

    if not v_has_correct then
      raise exception 'Each question needs at least 1 correct option';
    end if;
    v_qpos := v_qpos + 1;
  end loop;

  update public.quizzes set question_count = v_qpos where id = v_quiz;
  return v_quiz;
end;
$$;

grant execute on function public.create_quiz(text, text, text, jsonb, uuid) to authenticated;
revoke execute on function public.create_quiz(text, text, text, jsonb, uuid) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_quiz — structure complète POUR JOUER (sans is_correct)
-- ---------------------------------------------------------------------------

create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'resource_id', q.resource_id,
    'level_code', q.level_code,
    'subject_code', q.subject_code,
    'author_id', q.author_id,
    'author_username', p.username,
    'question_count', q.question_count,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'position', qq.position,
          'prompt', qq.prompt,
          'type', qq.type,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', qo.id, 'position', qo.position, 'label', qo.label)
              order by qo.position
            )
            from public.quiz_options qo where qo.question_id = qq.id
          ), '[]'::jsonb)
        ) order by qq.position
      )
      from public.quiz_questions qq where qq.quiz_id = q.id
    ), '[]'::jsonb)
  )
  from public.quizzes q
  join public.profiles p on p.id = q.author_id
  where q.id = p_quiz_id;
$$;

grant execute on function public.get_quiz(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC submit_quiz_attempt — scoring SERVEUR (non trichable)
-- p_answers : jsonb array de { "question_id": uuid, "selected_option_ids": [uuid,...] }
-- Retourne { score_pct, correct_count, total_count, corrections:[...] }
-- ---------------------------------------------------------------------------

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_total       int;
  v_correct     int := 0;
  v_q           record;
  v_selected    uuid[];
  v_correct_opts uuid[];
  v_is_correct  boolean;
  v_corrections jsonb := '[]'::jsonb;
  v_pct         int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = p_quiz_id;
  if v_total = 0 then raise exception 'Quiz has no questions'; end if;

  for v_q in
    select id from public.quiz_questions where quiz_id = p_quiz_id order by position
  loop
    -- Options sélectionnées par l'user pour cette question (dédupliquées + triées).
    select coalesce(array_agg(distinct x order by x), '{}')::uuid[]
      into v_selected
    from (
      select (jsonb_array_elements_text(a->'selected_option_ids'))::uuid as x
      from jsonb_array_elements(p_answers) a
      where (a->>'question_id')::uuid = v_q.id
    ) s;

    -- Bonnes options (triées).
    select coalesce(array_agg(id order by id), '{}')::uuid[]
      into v_correct_opts
    from public.quiz_options
    where question_id = v_q.id and is_correct = true;

    -- Correct ssi l'ensemble sélectionné == l'ensemble des bonnes réponses.
    v_is_correct := v_selected = v_correct_opts;
    if v_is_correct then v_correct := v_correct + 1; end if;

    v_corrections := v_corrections || jsonb_build_object(
      'question_id', v_q.id,
      'is_correct', v_is_correct,
      'correct_option_ids', to_jsonb(v_correct_opts)
    );
  end loop;

  v_pct := round(100.0 * v_correct / v_total);

  insert into public.quiz_attempts (quiz_id, user_id, score_pct, correct_count, total_count)
  values (p_quiz_id, v_user, v_pct, v_correct, v_total);

  return jsonb_build_object(
    'score_pct', v_pct,
    'correct_count', v_correct,
    'total_count', v_total,
    'corrections', v_corrections
  );
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
revoke execute on function public.submit_quiz_attempt(uuid, jsonb) from anon, public;

-- ---------------------------------------------------------------------------
-- RPC get_my_best_quiz_score — meilleur score de l'user sur un quiz (ou null)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_best_quiz_score(p_quiz_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select max(score_pct)
  from public.quiz_attempts
  where quiz_id = p_quiz_id and user_id = auth.uid();
$$;

grant execute on function public.get_my_best_quiz_score(uuid) to authenticated;
revoke execute on function public.get_my_best_quiz_score(uuid) from anon, public;

-- ---------------------------------------------------------------------------
-- Post-conditions de vérif :
--   - create_quiz(...) avec 2 questions → retourne un uuid, question_count = 2
--   - get_quiz(<id>) → JSON sans aucune clé is_correct
--   - submit_quiz_attempt(<id>, réponses justes) → score_pct 100
--   - submit à nouveau (score < 100) → get_my_best_quiz_score reste à 100
--   - select sur quiz_options en authenticated → 0 ligne (RLS deny-all)
-- ---------------------------------------------------------------------------
