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

## Matrice de résultats — DEV

| #    | Test                                                                 | Table             | Op     | Attendu | Observé | OK  |
| ---- | -------------------------------------------------------------------- | ----------------- | ------ | ------- | ------- | --- |
| 3.1  | Alice lit le post privé de Bob                                       | posts             | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.2  | Alice insère un post au nom de Bob                                   | posts             | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.3  | Alice modifie le post de Bob                                         | posts             | UPDATE | 0 ligne | \_\_\_  | ☐   |
| 3.4  | Alice supprime le post de Bob                                        | posts             | DELETE | 0 ligne | \_\_\_  | ☐   |
| 3.5  | Alice lit les messages d'une conv où elle n'est pas participante     | messages          | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.6  | Alice insère un message dans une conv où elle n'est pas participante | messages          | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.7  | Alice insère un message avec `sender_id = Bob` (usurpation)          | messages          | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.8  | Alice modifie un message envoyé par Bob                              | messages          | UPDATE | 0 ligne | \_\_\_  | ☐   |
| 3.9  | Alice lit la deletion_request de Bob                                 | deletion_requests | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.10 | Alice appelle `_anonymize_user_profile(Bob)` (escalade privilèges)   | (RPC)             | EXEC   | bloqué  | \_\_\_  | ☐   |
| 3.11 | Alice lit les notifications de Bob                                   | notifications     | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.12 | Alice lit la table blocks de Bob                                     | blocks            | SELECT | 0 ligne | \_\_\_  | ☐   |

## Matrice de résultats — STAGING

Reproduire l'audit sur STAGING après DEV.

| #    | Test | Table             | Op     | Attendu | Observé | OK  |
| ---- | ---- | ----------------- | ------ | ------- | ------- | --- |
| 3.1  | …    | posts             | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.2  | …    | posts             | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.3  | …    | posts             | UPDATE | 0 ligne | \_\_\_  | ☐   |
| 3.4  | …    | posts             | DELETE | 0 ligne | \_\_\_  | ☐   |
| 3.5  | …    | messages          | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.6  | …    | messages          | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.7  | …    | messages          | INSERT | bloqué  | \_\_\_  | ☐   |
| 3.8  | …    | messages          | UPDATE | 0 ligne | \_\_\_  | ☐   |
| 3.9  | …    | deletion_requests | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.10 | …    | (RPC)             | EXEC   | bloqué  | \_\_\_  | ☐   |
| 3.11 | …    | notifications     | SELECT | 0 ligne | \_\_\_  | ☐   |
| 3.12 | …    | blocks            | SELECT | 0 ligne | \_\_\_  | ☐   |

## Conclusion

À remplir après exécution :

- Date : **\_\_\_\_**
- Nombre de tests : 12 par environnement
- Nombre de succès : **_ / 12 (DEV) — _** / 12 (STAGING)
- Failles identifiées : aucune ou voir tickets ouverts
- Validation bêta : ☐ Go ☐ No-go

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
