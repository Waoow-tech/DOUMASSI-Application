## Ticket lié

Closes #XXX

## Checklist

- [ ] Le code compile et passe le lint local
- [ ] Les tests unitaires passent
- [ ] La couverture de tests respecte les seuils de ma zone (voir cadrage §9.4)
- [ ] J'ai testé manuellement le happy path + 2 cas d'erreur
- [ ] Les critères d'acceptation du ticket sont tous cochés
- [ ] Si nouveau composant : story / exemple ajouté
- [ ] Si changement de schéma DB : migration commitée + testée sur dev
- [ ] Si secret/env : documenté dans Notion
- [ ] Si nouveau coût API : monitoring PostHog mis à jour
- [ ] Aucun console.log oublié, aucun TODO sans issue liée
- [ ] Si j'ai ajouté du code dans `lib/`, `hooks/`, `services/` ou `stores/`, j'ai ajouté les tests correspondants. Sinon j'ai ouvert un ticket `type: tech` pour le faire dans le sprint.

## Captures

(Obligatoire pour tout changement UI — avant / après)

## Comment tester

1. git checkout cette branche
2. ...

## Points d'attention pour le reviewer

(Si une décision est discutable, pointe-la ici.)
