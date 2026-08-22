-- E9-01 (#261) — Taxonomie de la verticale Cours
--
-- Pose le squelette taxonomique : niveaux (groupés par cycle) et matières.
-- Contribution UGC libre À L'INTÉRIEUR de cette taxonomie fixe (l'user range
-- ses ressources, il ne crée jamais de catégorie). Cf brief
-- docs/cours-vertical-scope.md §3-4.
--
-- Public cible LARGE : du primaire au supérieur + autodidactes → un niveau
-- "Tout public / Autodidacte" en plus des niveaux scolaires.
--
-- Choix de design :
--   - Clé primaire = code text stable (ex. 'cp', '6e', 'terminale') plutôt
--     qu'un uuid : lisible dans les FK des ressources, et la taxonomie ne
--     change quasi jamais.
--   - `cycle` sur les niveaux pour grouper à l'affichage (Primaire / Collège
--     / Lycée / Supérieur / Tout public).
--   - `sort_order` pour un ordre d'affichage déterministe.
--   - `is_active` pour retirer une entrée sans casser les FK existantes.
--
-- RLS : lecture publique (anon + authenticated) — la taxonomie doit être
-- visible même sans compte. Écriture INTERDITE côté client : seule
-- l'administration (service role / SQL direct) peut modifier le référentiel.
--
-- Idempotent : create table if not exists + upsert du seed (on conflict).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.course_levels (
  code       text primary key,
  cycle      text not null,
  label      text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

comment on table public.course_levels is
  'E9-01 — Référentiel des niveaux Cours (groupés par cycle). Écriture admin only.';

create table if not exists public.course_subjects (
  code       text primary key,
  label      text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

comment on table public.course_subjects is
  'E9-01 — Référentiel des matières/domaines Cours. Écriture admin only.';

-- ---------------------------------------------------------------------------
-- RLS — lecture publique, écriture admin only (aucune policy write)
-- ---------------------------------------------------------------------------

alter table public.course_levels   enable row level security;
alter table public.course_subjects enable row level security;

drop policy if exists "course_levels public read" on public.course_levels;
create policy "course_levels public read"
  on public.course_levels
  for select
  to anon, authenticated
  using (true);

drop policy if exists "course_subjects public read" on public.course_subjects;
create policy "course_subjects public read"
  on public.course_subjects
  for select
  to anon, authenticated
  using (true);

-- Pas de policy INSERT/UPDATE/DELETE : RLS deny-by-default → écriture
-- impossible via anon/authenticated. Seul le service role (bypass RLS)
-- peut modifier le référentiel.

-- ---------------------------------------------------------------------------
-- Seed — Niveaux
-- ---------------------------------------------------------------------------

insert into public.course_levels (code, cycle, label, sort_order) values
  -- Primaire
  ('cp',        'primaire',    'CP',                    10),
  ('ce1',       'primaire',    'CE1',                   11),
  ('ce2',       'primaire',    'CE2',                   12),
  ('cm1',       'primaire',    'CM1',                   13),
  ('cm2',       'primaire',    'CM2',                   14),
  -- Collège
  ('6e',        'college',     '6ᵉ',                    20),
  ('5e',        'college',     '5ᵉ',                    21),
  ('4e',        'college',     '4ᵉ',                    22),
  ('3e',        'college',     '3ᵉ',                    23),
  -- Lycée
  ('2nde',      'lycee',       '2ⁿᵈᵉ',                  30),
  ('1ere',      'lycee',       '1ʳᵉ',                   31),
  ('terminale', 'lycee',       'Terminale',             32),
  -- Supérieur
  ('licence',   'superieur',   'Licence',               40),
  ('master',    'superieur',   'Master',                41),
  ('prepa',     'superieur',   'Prépa',                 42),
  ('bts_dut',   'superieur',   'BTS / DUT',             43),
  -- Tout public
  ('tout_public','tout_public','Tout public / Autodidacte', 50)
on conflict (code) do update set
  cycle      = excluded.cycle,
  label      = excluded.label,
  sort_order = excluded.sort_order,
  is_active  = true;

-- ---------------------------------------------------------------------------
-- Seed — Matières / Domaines (large, au-delà du scolaire)
-- ---------------------------------------------------------------------------

insert into public.course_subjects (code, label, sort_order) values
  ('maths',       'Mathématiques',              10),
  ('francais',    'Français / Lettres',         20),
  ('histoire_geo','Histoire-Géographie',        30),
  ('sciences',    'Sciences (SVT, Physique-Chimie)', 40),
  ('langues',     'Langues',                    50),
  ('philo',       'Philosophie',                60),
  ('eco_ses',     'Économie / SES',             70),
  ('informatique','Informatique / Programmation', 80),
  ('arts',        'Arts',                       90),
  ('autre',       'Autre',                      100)
on conflict (code) do update set
  label      = excluded.label,
  sort_order = excluded.sort_order,
  is_active  = true;

-- ---------------------------------------------------------------------------
-- Post-condition attendue (à vérifier manuellement après application) :
--   select cycle, count(*) from public.course_levels group by cycle;
--     → primaire 5, college 4, lycee 3, superieur 4, tout_public 1  (= 17)
--   select count(*) from public.course_subjects;  → 10
--   -- Vérifier que la lecture marche en anon et que l'écriture est refusée.
-- ---------------------------------------------------------------------------
