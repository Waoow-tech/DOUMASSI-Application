-- E13-01 — Âge minimum 15 ans (contrôle SERVEUR)
--
-- Voir ADR-008 §2.2. Seuil aligné sur la majorité numérique française.
--
-- Pourquoi un trigger et pas une contrainte CHECK : une CHECK doit être
-- IMMUTABLE, or calculer un âge dépend de la date du jour (now()/current_date).
-- Postgres refuse donc `check (age(birthday) >= 15)`. Le trigger est la bonne
-- primitive ici.
--
-- Portée volontairement limitée :
--   - INSERT : tout nouveau profil doit respecter le seuil.
--   - UPDATE OF birthday : on empêche de basculer vers une date hors seuil.
--   - birthday NULL toléré : des profils existants (et le flux Google avant
--     complete-account) n'ont pas encore de date. On ne casse pas l'existant ;
--     le seuil s'applique dès qu'une date est fournie.
--
-- ⚠️ Les comptes existants déjà sous le seuil ne sont PAS supprimés par cette
-- migration (ce serait destructif et hors périmètre technique). Un audit est
-- proposé en fin de fichier, à exécuter et arbitrer séparément.
--
-- Idempotent.

create or replace function public.enforce_min_age()
returns trigger
language plpgsql
as $$
declare
  -- [SEUIL] aligné sur MIN_AGE_YEARS côté client (src/features/auth/lib/age.ts).
  v_min_age constant int := 15;
begin
  if new.birthday is not null
     and new.birthday > (current_date - (v_min_age || ' years')::interval) then
    raise exception 'Âge minimum requis : % ans', v_min_age
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.enforce_min_age() is
  'E13-01 — refuse un profil dont la date de naissance implique moins de 15 ans (ADR-008).';

drop trigger if exists trg_enforce_min_age on public.profiles;
create trigger trg_enforce_min_age
  before insert or update of birthday on public.profiles
  for each row execute function public.enforce_min_age();

-- ---------------------------------------------------------------------------
-- Post-conditions attendues (dev) :
--   -- 1) Un profil sous le seuil est refusé
--   update public.profiles set birthday = current_date - interval '10 years'
--     where id = '<user>';                       -- => exception « Âge minimum requis : 15 ans »
--   -- 2) Un profil au-dessus du seuil passe
--   update public.profiles set birthday = current_date - interval '20 years'
--     where id = '<user>';                       -- => OK
--   -- 3) birthday NULL reste toléré (existant non cassé)
--   update public.profiles set birthday = null where id = '<user>';  -- => OK
--
-- AUDIT à exécuter séparément (combien de comptes existants sont sous le seuil ?) :
--   select count(*) from public.profiles
--   where birthday is not null
--     and birthday > (current_date - interval '15 years');
-- ---------------------------------------------------------------------------
