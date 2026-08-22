-- E13-03 (#353) — Mise en relation : schéma des intentions + opt-in
--
-- Voir ADR-008 §2.5 / §2.7 / §3.
--
-- Rappel du produit : le cœur n'est ni le swipe ni la suggestion, c'est
-- l'INTENTION DÉCLARÉE. Un utilisateur dit ce qu'il cherche / ce qu'il propose,
-- et l'app lui montre les personnes dont l'intention correspond.
--
-- ─── SÉCURITÉ — décision structurante ────────────────────────────────────────
-- La RLS n'autorise à lire QUE SES PROPRES intentions.
--
-- On n'ouvre PAS la lecture des intentions d'autrui en SELECT direct : sinon
-- n'importe quel client pourrait interroger la table et contourner à la fois
-- la SEGMENTATION PAR ÂGE et les BLOCAGES. La découverte passera donc
-- exclusivement par la RPC `get_matching_candidates` (E13-04, security definer),
-- qui applique ces garde-fous. Même patron que le wallet (lecture restreinte,
-- accès métier via RPC).
--
-- ─── OPT-IN ──────────────────────────────────────────────────────────────────
-- `profiles.matching_opt_in` par DÉFAUT À FALSE : personne n'est visible dans la
-- mise en relation sans l'avoir explicitement demandé. Non négociable dans une
-- app qui accueille des 15-17 ans.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Opt-in (porté par le profil, pour pouvoir se rendre invisible sans supprimer
-- ses intentions)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists matching_opt_in boolean not null default false;

comment on column public.profiles.matching_opt_in is
  'E13-03 — visible dans la mise en relation. FALSE par défaut (opt-in explicite, ADR-008 §2.7).';

-- ---------------------------------------------------------------------------
-- Table des intentions
-- ---------------------------------------------------------------------------
-- Une ligne PAR intention : un même utilisateur peut chercher un binôme en maths
-- ET proposer du soutien en physique ET chercher un associé.

create table if not exists public.matching_intents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,

  domain       text not null check (domain in ('scolaire', 'business')),
  direction    text not null check (direction in ('cherche', 'propose')),

  -- Volet scolaire : réutilise la taxonomie existante.
  -- level_code nullable = « tous niveaux ».
  subject_code text references public.course_subjects(code),
  level_code   text references public.course_levels(code),

  -- Volet business : tags libres en v1 (pas de taxonomie de compétences, ADR-008 §2.6).
  tags         text[],

  note         text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Cohérence par domaine : le champ discriminant doit être renseigné.
  constraint matching_intents_domain_fields check (
    (domain = 'scolaire' and subject_code is not null)
    or
    (domain = 'business' and tags is not null and array_length(tags, 1) >= 1)
  )
);

comment on table public.matching_intents is
  'E13-03 — intentions de mise en relation (scolaire | business). Découverte via get_matching_candidates uniquement.';
comment on column public.matching_intents.level_code is
  'Niveau scolaire ; NULL = tous niveaux.';
comment on column public.matching_intents.tags is
  'Volet business : compétences/secteurs en texte libre (v1, sans taxonomie).';

-- Lecture de ses propres intentions.
create index if not exists idx_matching_intents_user
  on public.matching_intents (user_id);

-- Requête de découverte (E13-04) : appariement scolaire.
create index if not exists idx_matching_intents_scolaire
  on public.matching_intents (domain, direction, subject_code, level_code)
  where is_active = true;

-- Appariement business par tags.
create index if not exists idx_matching_intents_tags
  on public.matching_intents using gin (tags)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- RLS — deny-by-default, lecture restreinte à SES PROPRES intentions
-- ---------------------------------------------------------------------------

alter table public.matching_intents enable row level security;

drop policy if exists "matching_intents owner read" on public.matching_intents;
create policy "matching_intents owner read"
  on public.matching_intents for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "matching_intents owner insert" on public.matching_intents;
create policy "matching_intents owner insert"
  on public.matching_intents for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "matching_intents owner update" on public.matching_intents;
create policy "matching_intents owner update"
  on public.matching_intents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "matching_intents owner delete" on public.matching_intents;
create policy "matching_intents owner delete"
  on public.matching_intents for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--
--   -- 1) Opt-in désactivé par défaut pour tout le monde
--   select count(*) from public.profiles where matching_opt_in = true;   -- => 0
--
--   -- 2) Je peux créer MON intention scolaire
--   insert into public.matching_intents (user_id, domain, direction, subject_code, level_code)
--   values (auth.uid(), 'scolaire', 'cherche', 'maths', '1ere');          -- => OK
--
--   -- 3) Cohérence : une intention scolaire SANS matière est refusée
--   insert into public.matching_intents (user_id, domain, direction)
--   values (auth.uid(), 'scolaire', 'cherche');                           -- => check violation
--
--   -- 4) Cohérence : une intention business SANS tag est refusée
--   insert into public.matching_intents (user_id, domain, direction)
--   values (auth.uid(), 'business', 'propose');                           -- => check violation
--
--   -- 5) SÉCURITÉ : je ne vois PAS les intentions des autres en direct
--   select count(*) from public.matching_intents where user_id <> auth.uid();  -- => 0
--
--   -- 6) SÉCURITÉ : je ne peux pas créer une intention au nom d'un autre
--   insert into public.matching_intents (user_id, domain, direction, tags)
--   values ('<autre_user>', 'business', 'propose', array['dev']);         -- => refusé (RLS)
-- ---------------------------------------------------------------------------
