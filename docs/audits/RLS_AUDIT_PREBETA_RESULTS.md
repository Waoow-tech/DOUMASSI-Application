# Audit RLS Pré-bêta — Résultats

Audit de sécurité avant l'ouverture de la bêta fermée du 12 juin 2026.
Script source : [`supabase/audits/rls_audit_prebeta.sql`](../../supabase/audits/rls_audit_prebeta.sql)

## Méthodologie

Création de 2 users factices (Alice et Bob), génération de données croisées,
puis bascule du rôle SQL vers `authenticated` en simulant le JWT d'Alice via
`set_config('request.jwt.claims', ...)`. Pour chaque table, on tente la liste
de contournements ci-dessous. Le résultat attendu est toujours **bloqué**
(SELECT retourne 0 ligne, INSERT/UPDATE/DELETE bloqué par la policy).

## Comment exécuter

1. Coller le contenu de `rls_audit_prebeta.sql` dans **AI Supabase sur DEV**
2. Lire la sortie : les `RAISE NOTICE` apparaissent dans le résultat
3. Cocher la case ci-dessous correspondante
4. Si un test échoue (`ok=f`), créer un ticket bug et corriger AVANT la bêta

## Matrice de résultats — DEV (exécuté 2026-06-05)

| #    | Test                                                                 | Table             | Op     | Attendu | Observé | OK  |
| ---- | -------------------------------------------------------------------- | ----------------- | ------ | ------- | ------- | --- |
| 3.1  | Alice lit le post privé de Bob                                       | posts             | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.2  | Alice insère un post au nom de Bob                                   | posts             | INSERT | bloqué  | BLOCKED | ✅  |
| 3.3  | Alice modifie le post de Bob                                         | posts             | UPDATE | 0 ligne | 0 rows  | ✅  |
| 3.4  | Alice supprime le post de Bob                                        | posts             | DELETE | 0 ligne | 0 rows  | ✅  |
| 3.5  | Alice lit les messages d'une conv où elle n'est pas participante     | messages          | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.6  | Alice insère un message dans une conv où elle n'est pas participante | messages          | INSERT | bloqué  | BLOCKED | ✅  |
| 3.7  | Alice insère un message avec `sender_id = Bob` (usurpation)          | messages          | INSERT | bloqué  | BLOCKED | ✅  |
| 3.8  | Alice modifie un message envoyé par Bob                              | messages          | UPDATE | 0 ligne | 0 rows  | ✅  |
| 3.9  | Alice lit la deletion_request de Bob                                 | deletion_requests | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.10 | Alice appelle `_anonymize_user_profile(Bob)` (escalade privilèges)   | (RPC)             | EXEC   | bloqué  | BLOCKED | ✅  |
| 3.11 | Alice lit les notifications de Bob                                   | notifications     | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.12 | Alice lit la table blocks de Bob                                     | blocks            | SELECT | 0 ligne | 0 ligne | ✅  |

## Matrice de résultats — STAGING (exécuté 2026-06-05)

| #    | Test            | Table             | Op     | Attendu | Observé | OK  |
| ---- | --------------- | ----------------- | ------ | ------- | ------- | --- |
| 3.1  | Identique à DEV | posts             | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.2  | Identique à DEV | posts             | INSERT | bloqué  | BLOCKED | ✅  |
| 3.3  | Identique à DEV | posts             | UPDATE | 0 ligne | 0 rows  | ✅  |
| 3.4  | Identique à DEV | posts             | DELETE | 0 ligne | 0 rows  | ✅  |
| 3.5  | Identique à DEV | messages          | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.6  | Identique à DEV | messages          | INSERT | bloqué  | BLOCKED | ✅  |
| 3.7  | Identique à DEV | messages          | INSERT | bloqué  | BLOCKED | ✅  |
| 3.8  | Identique à DEV | messages          | UPDATE | 0 ligne | 0 rows  | ✅  |
| 3.9  | Identique à DEV | deletion_requests | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.10 | Identique à DEV | (RPC)             | EXEC   | bloqué  | BLOCKED | ✅  |
| 3.11 | Identique à DEV | notifications     | SELECT | 0 ligne | 0 ligne | ✅  |
| 3.12 | Identique à DEV | blocks            | SELECT | 0 ligne | 0 ligne | ✅  |

## 🚨 Bug critique découvert et corrigé pendant l'audit

**Récursion infinie sur `conversation_participants` SELECT policy** — la policy créée dans PR #192 (20260602120000_messaging_schema.sql) contenait un `EXISTS (SELECT FROM conversation_participants WHERE ...)` qui se référençait elle-même. Toute lecture sur cette table déclenchait l'erreur Postgres :

> `infinite recursion detected in policy for relation "conversation_participants"` (SQLSTATE 42P17)

**Impact évité** : les écrans messagerie (PR #196 conversation, PR #203 liste conversations, PR #201 Realtime) auraient tous crashé en bêta dès qu'un user authentifié ouvrait un fil de discussion. Le bug n'était pas visible en dev local parce que les fixtures de test direct via SQL bypassaient la RLS.

**Fix appliqué** : migration `20260605120100_fix_conversation_participants_rls_recursion.sql` qui :

1. Crée une fonction `fn_is_conversation_participant(uuid)` `SECURITY DEFINER STABLE` qui lit la table sans déclencher la RLS
2. Remplace le subquery récursif de la policy par un appel à cette fonction

Audit re-exécuté après fix : **12/12 OK**.

## Conclusion

- **Date** : 2026-06-05
- **Nombre de tests** : 12 par environnement
- **Nombre de succès** : **12 / 12 (DEV)** — **12 / 12 (STAGING)**
- **Failles identifiées** :
  - 1 bug critique de **récursion infinie sur `conversation_participants`** SELECT policy — corrigé via migration `20260605120100_fix_conversation_participants_rls_recursion.sql` (fonction helper SECURITY DEFINER `fn_is_conversation_participant`)
- **Validation bêta** : ✅ **Go** — la sécurité RLS de l'application est validée pour l'ouverture de la bêta du 12 juin

## Limites de cet audit

Cet audit couvre les **règles RLS principales** des tables critiques. Il ne
couvre pas :

- Les politiques Storage (déjà auditées sur PR #191)
- Les RPCs autres que `_anonymize_user_profile` (peuvent être ajoutées au
  script si nécessaire)
- Les attaques par injection SQL côté client (mitigation : on n'utilise que
  le client paramétré supabase-js)
- Les fuites de données via Realtime (à auditer séparément avec un test
  manuel : subscribe à un channel et vérifier qu'on ne reçoit que les rows
  RLS-autorisées — déjà testé indirectement par #78 quand on l'aura
  implémenté)

À ré-exécuter à chaque ajout de table sensible ou de policy RLS.
