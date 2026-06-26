# Bug bash équipe — Sprint 7

> Ticket [#107](https://github.com/Waoow-tech/DOUMASSI-Application/issues/107). Trame opérationnelle prête à exécuter le jour J.

## 🎯 Objectif

Détecter le maximum de bugs en 2h de test concentré et coordonné, AVANT la promotion bêta → release publique. Couvrir spécifiquement les **features post-bêta livrées Sprint 6** (PRs #218 à #226) qui n'ont pas encore été stress-testées par les utilisateurs externes.

## 📅 Format

- **Quand** : lundi 8 juin 2026, **10h00 → 12h00**
- **Où** : tous présents (mode hybride OK), Slack `#beta-feedback` ouvert
- **Format** : Pomodoro 25 min + 5 min de pause × 4
- **Brief & debrief** : 9h45 (intro) + 12h00 (synthèse)

## 👥 Équipe

| Membre | Rôle ce jour                      | Device(s)     |
| ------ | --------------------------------- | ------------- |
| Abdou  | Coordinateur + test cross-feature | iOS + Android |
| Biram  | Testeur                           | iOS           |
| Farah  | Testeuse                          | Android + iOS |
| Ilias  | Testeur                           | Android       |

## 🎲 Attribution aléatoire des features

Faire 4 papiers, chacun tire au hasard sa **feature principale**. Tester ensuite 1 feature secondaire choisie librement.

### Pool de features

1. **Mentions `@username`** (#213) — posts, commentaires, messages, dropdown suggestions
2. **Partage profil + Universal Links** (#219 / #220) — `/u/{username}` deep link
3. **Modale annulation suppression compte au login** (#214)
4. **A11y polish** (#215) — VoiceOver, Dynamic Type, contrastes
5. **Image dans message** (#210) — galerie / caméra / envoi / réception
6. **Vocal dans message** (#211) — record / play / 60s max / permissions
7. **Création de groupe conversation** (#212) — toggle, multi-select, nom, RPC
8. **Régression core** — feed, profile, follow, stories, notifications, RGPD

## 📋 Parcours de test détaillés

### #213 — Mentions `@username`

1. Composer post → taper `@al` → dropdown apparaît ✅
2. Tap sur suggestion → `@alice ` inséré, curseur juste après l'espace
3. Taper `email@example.com` → la dropdown NE doit PAS s'ouvrir (`@` après lettre)
4. Atteindre 6 mentions → bouton Publier grisé + banner rouge
5. Publier un post avec mention → le user mentionné reçoit une notif `mention`
6. Tap sur la mention en feed → ouvre `/profile/u/{username}` → résout vers le profil
7. **Idem pour les messages** (composer message + bulle)
8. **Idem pour les commentaires** (saisir mention dans CommentRow → trigger DB notifie)
9. Tester avec un username inconnu (`@nimportequoi`) → pas de notif générée, mais rendu en vert quand même
10. Tester avec self-mention → pas de notif (skip auto)

### #219 / #220 — Partage profil + Universal Links

1. Mon profil → kebab → « Partager mon profil » → vérifier message + URL
2. Profil d'un autre → kebab → « Partager hors DOUMASSI » → vérifier FR + URL
3. Tap sur le lien `https://doumassi.app/u/{username}` depuis WhatsApp avec app installée → l'app s'ouvre direct sur le profil cible
4. Idem iOS via TestFlight
5. Si app pas installée : browser ouvre la landing (pas 404)

### #214 — Modale suppression compte

1. Settings → Compte → Supprimer mon compte → confirme → logout
2. Login à nouveau → la modale apparaît sur le feed
3. Tap « Plus tard » → modale fermée, ne réapparaît plus pendant la session
4. Naviguer entre les tabs → pas de modale qui ressort
5. Logout / login → la modale réapparaît
6. Tap « Annuler la demande » → Alert de succès, modale fermée, statut DB cohérent
7. Vérifier que onboarding skip bien la modale

### #215 — A11y polish

1. Activer VoiceOver iOS / TalkBack Android
2. Focus sur Like d'un post → entendre nom + état + hint (« Tap pour aimer ce post »)
3. Focus sur « Votre story » → entendre « Tap pour créer une nouvelle story »
4. StoryViewer zone milieu → entendre « Tap pour mettre en pause »
5. Activer Dynamic Type à font scale max
6. Vérifier que tab labels / boutons / notifications restent lisibles
7. Bulle « Message supprimé » sur otherBubble → contraste lisible (a été #6B → #8A)
8. Lancer Accessibility Scanner Android sur 5 écrans clés → rapport dans `docs/accessibility/post-beta-results.md`

### #210 — Image dans message

1. Conversation 1-to-1 → tap « + » → Alert apparaît
2. Galerie → permission OK → sélection → upload → bulle apparaît avec image
3. Caméra → permission OK → prise → upload → bulle
4. Pendant l'upload : spinner sur « + », bouton Send désactivé
5. L'autre participant voit l'image en realtime
6. Permission refusée → Alert d'instructions
7. Échec upload (mode avion) → Alert d'erreur

### #211 — Vocal dans message

1. Input vide → bouton mic visible
2. Tap mic → banner rouge avec timer + audio recording (vérifier permission)
3. Tap encore → upload + bulle apparaît avec Play/durée
4. Tap Play sur la bulle → audio joue
5. Auto-stop à 60s vérifié (laisser tourner)
6. Permission micro refusée → silencieux (notes follow-up : ajouter Alert)
7. Échec upload → Alert
8. Bulle reçue côté autre user (realtime) → tap Play marche

### #212 — Groupe conversation

1. Tab Messages → + → écran new
2. Toggle « Groupe » → champ nom + checkmarks apparaissent
3. Tap 3 users → chips apparaissent en haut
4. Tap chip → retire du groupe
5. Si nom vide ou 0 participant : bouton grisé
6. Tap « Créer le groupe » → push dans la conversation
7. Liste conversations : nom du groupe + icône Users visibles
8. Envoyer message → l'autre membre le reçoit
9. Tenter de créer groupe avec user bloqué → erreur RPC visible

### Régression core (à faire en parallèle par tous)

- [ ] Login / logout / signup
- [ ] Onboarding complet
- [ ] Créer un post texte
- [ ] Créer un post avec 1-4 images
- [ ] Like / commenter / sauvegarder un post
- [ ] Follow un autre user
- [ ] Story photo et story vidéo
- [ ] « Vu par » sur ma story
- [ ] Notifications push reçues
- [ ] Tap sur notif → bonne destination
- [ ] Export RGPD JSON
- [ ] Edit profil + avatar
- [ ] Block / unblock

## 🐛 Template fiche bug (à coller dans `#beta-feedback` puis GitHub Issue)

```
**Bug** : [titre 1 ligne]

**Ce que j'ai fait** :
1. ...
2. ...
3. ...

**Ce que j'attendais** : ...

**Ce qui s'est passé** : ...

**OS / device** : iOS 17.5 sur iPhone 14 — ou Android 14 sur Pixel 7
**Build** : v0.1.0-beta build 42 (TestFlight) / [version Play Store]

**Priorité estimée** : P0 / P1 / P2 / P3
- P0 : crash, perte de données, faille de sécurité
- P1 : feature cassée, fonctionnalité majeure inutilisable
- P2 : feature dégradée, ergonomie cassée
- P3 : nice-to-have, polish

**Capture / vidéo** : (joindre)
```

## 🔁 Workflow par bug trouvé

1. **Capturer immédiatement** la vidéo / screenshot (sinon perdu)
2. **Poster dans `#beta-feedback`** Slack avec le template
3. **Ouvrir une issue GitHub** avec le préfixe `[BUG]` + label de priorité estimée
4. **Continuer le test** (ne pas s'éterniser sur le diag — on tag, on continue)

## 📊 Synthèse à 12h00

- **Tableau Markdown** dans `#beta-feedback` :
  ```
  | # | Issue | Feature | Priorité | Assigné à |
  |---|-------|---------|----------|-----------|
  ```
- **Repriorisation** : tout P0 = hotfix dans la journée
- **Décisions** : merger ou rebrancher chaque PR ouverte à l'instant
- **Action items** : qui prend quoi pour Sprint 8

## ✅ Critères de succès

- [ ] ≥ 20 bugs documentés au total
- [ ] 100% des features Sprint 6 testées au moins par 1 personne
- [ ] Tous les P0 fixés ou en branche de fix avant 18h
- [ ] Rapport synthèse posté dans `#beta-feedback`

## 🍕 Logistique

- **Café / thé** : à organiser
- **Snacks** : à organiser
- **Déjeuner** : on commande après la synthèse 12h
