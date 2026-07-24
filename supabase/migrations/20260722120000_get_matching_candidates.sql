-- E13-04 (#354) — Mise en relation : RPC de découverte
--
-- Voir ADR-008 §2.7 / §3. Dépend de E13-03 (matching_intents + opt-in).
--
-- C'est LE point sensible de l'épic : la RLS de `matching_intents` ne laisse lire
-- que ses propres intentions (E13-03), donc cette RPC `security definer` est le
-- SEUL chemin de découverte. Tous les garde-fous vivent donc ici.
--
-- ─── LES QUATRE GARDE-FOUS ───────────────────────────────────────────────────
--
--  1. OPT-IN RÉCIPROQUE — il faut être soi-même visible pour voir les autres.
--     Ce n'est pas qu'une question d'équité : sans ça, un adulte pourrait
--     parcourir les intentions de mineurs tout en restant invisible. Inacceptable.
--
--  2. SEGMENTATION PAR ÂGE — les mineurs ne voient que des mineurs, les majeurs
--     que des majeurs. Calculée SERVEUR depuis `birthday`, jamais transmise par
--     le client.
--
--  3. DATE DE NAISSANCE OBLIGATOIRE — sans elle, impossible de déterminer la
--     tranche. On refuse plutôt que de deviner : un profil sans date ne peut ni
--     parcourir, ni être montré.
--
--  4. BLOCAGES BILATÉRAUX — on exclut ceux que j'ai bloqués ET ceux qui m'ont
--     bloqué (dans les deux sens).
--
-- Idempotent.

create or replace function public.get_matching_candidates(
  p_domain       text,
  p_subject_code text        default null,   -- requis si domain = 'scolaire'
  p_level_code   text        default null,   -- null = tous niveaux
  p_tags         text[]      default null,   -- requis si domain = 'business'
  p_direction    text        default null,   -- filtre optionnel : 'cherche' | 'propose'
  p_limit        int         default 20,
  p_cursor       timestamptz default null
)
returns table (
  intent_id     uuid,
  user_id       uuid,
  username      text,
  full_name     text,
  avatar_url    text,
  is_verified   boolean,
  domain        text,
  direction     text,
  subject_code  text,
  level_code    text,
  tags          text[],
  note          text,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me       uuid := auth.uid();
  v_birthday date;
  v_opted_in boolean;
  v_is_adult boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_domain not in ('scolaire', 'business') then
    raise exception 'Domaine invalide : %', p_domain;
  end if;

  -- Cohérence des paramètres selon le domaine.
  if p_domain = 'scolaire' and p_subject_code is null then
    raise exception 'Une matière est requise pour le domaine scolaire';
  end if;
  if p_domain = 'business' and (p_tags is null or array_length(p_tags, 1) is null) then
    raise exception 'Au moins un tag est requis pour le domaine business';
  end if;

  select pr.birthday, pr.matching_opt_in
    into v_birthday, v_opted_in
  from public.profiles pr
  where pr.id = v_me;

  -- Garde-fou 1 : opt-in réciproque.
  if not coalesce(v_opted_in, false) then
    raise exception 'Active la mise en relation sur ton profil pour découvrir des personnes'
      using errcode = 'insufficient_privilege';
  end if;

  -- Garde-fou 3 : date de naissance obligatoire (sinon tranche d'âge inconnue).
  if v_birthday is null then
    raise exception 'Date de naissance requise pour la mise en relation'
      using errcode = 'insufficient_privilege';
  end if;

  -- Garde-fou 2 : ma tranche d'âge, calculée SERVEUR.
  v_is_adult := v_birthday <= (current_date - interval '18 years');

  return query
  select
    i.id,
    i.user_id,
    pr.username,
    pr.full_name,
    pr.avatar_url,
    coalesce(pr.is_verified, false),
    i.domain,
    i.direction,
    i.subject_code,
    i.level_code,
    i.tags,
    i.note,
    i.created_at
  from public.matching_intents i
  join public.profiles pr on pr.id = i.user_id
  where i.is_active = true
    -- Jamais soi-même.
    and i.user_id <> v_me
    -- Garde-fou 1 : la cible doit aussi être opt-in.
    and pr.matching_opt_in = true
    -- Garde-fou 3 : pas de date → jamais montré.
    and pr.birthday is not null
    -- Garde-fou 2 : même tranche d'âge (mineurs entre eux, majeurs entre eux).
    and (pr.birthday <= (current_date - interval '18 years')) = v_is_adult
    -- Garde-fou 4 : blocages dans les DEUX sens.
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v_me and b.blocked_id = i.user_id)
         or (b.blocker_id = i.user_id and b.blocked_id = v_me)
    )
    -- Filtre optionnel sur la direction (sinon on renvoie « cherche » ET
    -- « propose » : deux personnes qui cherchent un binôme sur la même matière
    -- sont un excellent appariement, pas seulement cherche↔propose).
    and (p_direction is null or i.direction = p_direction)
    -- Appariement par domaine.
    and (
      (
        p_domain = 'scolaire'
        and i.domain = 'scolaire'
        and i.subject_code = p_subject_code
        -- Niveau compatible : null d'un côté ou de l'autre = « tous niveaux ».
        and (p_level_code is null or i.level_code is null or i.level_code = p_level_code)
      )
      or
      (
        p_domain = 'business'
        and i.domain = 'business'
        and i.tags && p_tags          -- recoupement d'au moins un tag
      )
    )
    -- Pagination par curseur.
    and (p_cursor is null or i.created_at < p_cursor)
  order by i.created_at desc
  limit least(coalesce(p_limit, 20), 50);   -- borne dure anti-aspiration
end;
$$;

grant execute on function public.get_matching_candidates(text, text, text, text[], text, int, timestamptz)
  to authenticated;
revoke execute on function public.get_matching_candidates(text, text, text, text[], text, int, timestamptz)
  from anon, public;

comment on function public.get_matching_candidates(text, text, text, text[], text, int, timestamptz) is
  'E13-04 — découverte de mise en relation. Seul chemin d''accès aux intentions d''autrui. Applique opt-in réciproque, segmentation d''âge, blocages bilatéraux (ADR-008).';

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) — inclut des TENTATIVES DE CONTOURNEMENT :
--
--   -- 1) Sans opt-in → refusé (même avec des intentions existantes)
--   select public.get_matching_candidates('scolaire', 'maths');
--        -- => « Active la mise en relation sur ton profil… »
--
--   -- 2) Après opt-in mais sans birthday → refusé
--   update public.profiles set matching_opt_in = true, birthday = null where id = auth.uid();
--   select public.get_matching_candidates('scolaire', 'maths');
--        -- => « Date de naissance requise… »
--
--   -- 3) Nominal : deux majeurs opt-in, même matière → se voient
--   -- 4) SEGMENTATION : un mineur (birthday 16 ans) ne voit AUCUN majeur, et
--   --    réciproquement. C'est LE test à ne pas rater.
--   -- 5) BLOCAGE : après insert dans blocks (dans un sens OU dans l'autre),
--   --    le profil disparaît des résultats des deux côtés.
--   -- 6) Paramètres : domaine scolaire sans matière → exception ;
--   --    domaine business sans tag → exception.
--   -- 7) Borne : p_limit = 1000 → renvoie au plus 50 lignes.
--   -- 8) CONTOURNEMENT : le SELECT direct reste impossible malgré la RPC
--   select count(*) from public.matching_intents where user_id <> auth.uid();  -- => 0
-- ---------------------------------------------------------------------------
