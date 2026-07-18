# Cadrage — Tests des RPC / invariants DB (pgTAP)

> Objectif : tester le **cœur transactionnel** (les RPC `security definer`, les
> triggers, la RLS), là où vit la sécurité — en particulier celle de l'argent
> (wallet Dcoins, E12, et bientôt l'argent réel).
> Statut : **proposé** — à valider CTO. Fait suite à la décision de consolider
> avant d'attaquer les phases paiement (ADR-006/007).

---

## 1. Pourquoi

Les tests jest (E12, PR #346) couvrent la **couche app** (hooks, mapper d'erreurs,
génération de clé d'idempotence). Ils ne touchent **pas** aux garanties qui vivent
côté Postgres :

- **Conservation** : un transfert P2P écrit 2 lignes qui se somment à zéro.
- **Idempotence** sous verrou : un retry ne double-débite pas.
- **Solde jamais négatif** (CHECK + garde applicative).
- **Permissions** : un user ne peut pas s'auto-créditer (`wallet_grant` = service_role).
- **Non-farmable** : chaque gain (signup/quiz/cours/daily) crédite 1× (clé d'idempotence).

Aujourd'hui, ces garanties ne sont validées que par des **post-conditions manuelles**
qu'on rejoue à la main après chaque migration. Insuffisant pour du code qui manipulera
bientôt de l'argent réel.

## 2. La convention existe déjà

Le repo a **déjà** un test pgTAP : `supabase/tests/rls_posts_private_profiles.test.sql`.
On la réutilise telle quelle :

- extension **pgTAP** (`create extension if not exists pgtap;`)
- structure `begin; select plan(N); … select is(...); select * from finish(); rollback;`
- simulation de `auth.uid()` via `set_config('request.jwt.claims', '{"sub":"…"}', true)`
  et `set_config('role', 'authenticated'|'anon'|'postgres', true)`
- lancement : **`supabase test db`** (Supabase CLI, Postgres local).

## 3. Le blocage à lever d'abord : le schéma de base n'est pas dans le repo

Constat : les tables de base (`profiles`, `posts`, `listings`, `blocks`, `follows`…)
ont été déployées **hors migrations** (dashboard, Sprint 0). Elles sont **référencées
par 28 migrations mais créées par 0**.

Conséquence : `supabase test db` applique les migrations du repo sur une DB **fraîche**
→ ces tables **n'existent pas** → **ni** le test RLS existant **ni** de futurs tests
wallet ne peuvent tourner localement/en CI. (Le test RLS actuel n'a probablement
jamais tourné en CI pour cette raison.)

**Prérequis obligatoire** : capturer le schéma de base dans le repo.

```bash
# Depuis un environnement lié (dev ou staging), dumper le schéma public en un
# fichier de migration "baseline" qui précède toutes les autres.
supabase link --project-ref kbysmkhalnolbsojzahf   # dev
supabase db dump --schema public > supabase/migrations/00000000000000_baseline.sql
```

Après ça, une DB fraîche = baseline + toutes les migrations incrémentales →
reconstruction complète → `supabase test db` fonctionne. C'est l'étape standard
d'« adoption des migrations » quand on a commencé au dashboard.

> ⚠️ À faire proprement : vérifier que le dump ne contient pas de secrets / de
> policies liées à des rôles spécifiques, et qu'il est idempotent vis-à-vis des
> migrations suivantes (sinon doublons de `create table`).

## 4. Où on lance les tests

| Option                                                      | Local | CI                          | Coût                                       |
| ----------------------------------------------------------- | ----- | --------------------------- | ------------------------------------------ |
| **A. Supabase CLI** (`supabase start` + `supabase test db`) | ✅    | ✅ (runner GitHub a Docker) | CLI + Docker                               |
| B. Service Postgres CI + pgTAP à la main                    | ❌    | ✅                          | plus de plomberie, on reperd la convention |
| C. Contre la DB dev via MCP                                 | ✅    | ❌                          | pas reproductible, pollue dev              |

**Reco : Option A.** C'est déjà la convention du repo (le test existant dit
« Lancer avec `supabase test db` »), c'est reproductible, et ça tourne en CI.

## 5. Découpage proposé

- **T-01 — Débloquer** : baseline schema dump (`supabase db dump`) + `supabase/config.toml`
  (init CLI). Vérifier que `supabase db start` reconstruit tout et que le test RLS
  existant **passe enfin**.
- **T-02 — Tests wallet** (`supabase/tests/wallet_*.test.sql`) :
  - `wallet_ledger.test.sql` : conservation (transfert → `sum(amount)=0`), solde =
    somme du ledger, solde jamais négatif (`wallet_spend` > solde → exception).
  - `wallet_idempotency.test.sql` : rejeu de la même clé (grant / transfer / spend)
    ne double-crédite pas ; les 2 legs d'un transfert (clé + clé dérivée `:in:`).
  - `wallet_permissions.test.sql` : `authenticated` ne peut PAS `wallet_grant` /
    `_wallet_apply` ; transfert vers soi-même refusé ; boost d'une annonce d'autrui refusé.
  - `wallet_rewards.test.sql` : non-farmable — 2e signup/quiz/daily/publication ne
    recrédite pas ; backfill à 100.
- **T-03 — CI** : job GitHub Actions qui installe la CLI, `supabase db start`,
  `supabase test db`. (Indépendant : activer aussi le job **jest** déjà commenté
  dans `ci.yml` — voir §6.)

## 6. Gain immédiat, orthogonal : activer le job jest en CI

`ci.yml` a un job `test:` **commenté** avec la note « activé quand des tests
existeront ». Ils existent (40 tests). → **À décommenter maintenant**, indépendamment
de tout le reste. Petit, sûr, immédiat.

## 7. Hors scope

- Tests de charge / perf des RPC.
- Tests des Edge Functions (autre chaîne).
- Le dump baseline ne doit PAS embarquer les données — schéma uniquement.

---

_Prochaine étape si validé : T-01 (baseline) — c'est le prérequis qui débloque
tout le reste. Nécessite un `supabase link` + `supabase db dump` par le CTO
(accès projet)._
