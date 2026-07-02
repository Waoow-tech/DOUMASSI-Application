# Brief de scope — Verticale COURS (épique E9)

> Document de cadrage de la verticale "Cours" du Business Hub DOUMASSI.
> Statut : **proposition à valider** (CTO). Rédigé le 2026-07-02.
> Nouvelle verticale hors cadrage Phase 1 v1.1 — à confirmer avant build
> (cf CLAUDE.md règle #8).

---

## 1. Vision

Une **bibliothèque collaborative de contenu pédagogique**, alimentée par les
utilisateurs eux-mêmes (UGC). L'idée n'est PAS que DOUMASSI produise ou publie
les cours — ce sont les gens qui partagent ce qu'ils savent (cours, fiches,
exos, quiz), et la plateforme se contente de **bien ranger** ce contenu pour
que n'importe qui retrouve facilement un cours ou un quiz sur un sujet donné.

Esprit : "le Wikipédia des cours" croisé avec un espace d'entraide.
Référence mentale évoquée : Moodle, mais **communautaire et auto-alimenté**.

---

## 2. Public cible

**Large** : du primaire au supérieur, + autodidactes.

Conséquence directe sur la taxonomie : la notion de "niveau" doit couvrir
autant un CM2 qu'un étudiant en licence ou un autodidacte qui apprend la
programmation. On prévoit donc un niveau "Tout public / Autodidacte" en plus
des niveaux scolaires classiques.

---

## 3. Principe fondateur : la taxonomie comme colonne vertébrale

Le défi central : concilier **contribution libre** (UGC) et **contenu bien
rangé** (retrouvable). La réponse :

- **On définit une taxonomie fixe** (le squelette) : Niveau × Matière × Type.
- **L'utilisateur contribue librement à l'intérieur** : il publie une
  ressource et la **range** dans (Niveau × Matière × Type). Il ne crée
  jamais de nouvelle catégorie.

C'est ce qui garantit que "je cherche un exo de Maths Terminale" tombe direct
sur le bon contenu, sans qu'on ait à modérer/organiser manuellement.

---

## 4. Taxonomie proposée (à valider)

### Niveaux (groupés par cycle)

- **Primaire** : CP, CE1, CE2, CM1, CM2
- **Collège** : 6e, 5e, 4e, 3e
- **Lycée** : 2nde, 1ère, Terminale
- **Supérieur** : Licence, Master, Prépa, BTS/DUT (générique au départ)
- **Tout public / Autodidacte**

> Stockés en table `course_levels` avec un champ `cycle` pour grouper à
> l'affichage. Seed data défini par nous.

### Matières / Domaines (large, au-delà du scolaire)

Mathématiques · Français / Lettres · Histoire-Géographie ·
Sciences (SVT, Physique-Chimie) · Langues · Philosophie · Économie / SES ·
Informatique / Programmation · Arts · Autre

> Stockées en table `course_subjects`. Seed data défini par nous.

### Types de ressource

Cours · Fiche de révision · Exercices · Annale / Sujet · **Quiz** (objet à
part, cf §7).

---

## 5. Les 3 objets clés

1. **Ressource** — le contenu partagé : titre, description, auteur, niveau,
   matière, type, fichiers (PDF/images), statut de modération.
2. **Quiz** — une liste de questions interactives, optionnellement rattachée à
   une ressource (cf §7).
3. **Communauté** — émergente, pas de groupes formels (cf §8).

---

## 6. Modèle de données (concept, pas le SQL final)

- `course_levels` — taxonomie niveaux (seed) + `cycle`
- `course_subjects` — taxonomie matières (seed)
- `resources` — contenu UGC (author_id, level_id, subject_id, type, title,
  description, files[], status, created_at)
- `resource_bookmarks` — favoris (même pattern que `listing_bookmarks`)
- `resource_reports` — signalements (resource_id, reporter_id, reason, status)
- `quizzes` — (author_id, resource_id nullable, level_id, subject_id, title)
- `quiz_questions` — (quiz_id, ordre, énoncé, type : qcm / vrai-faux)
- `quiz_options` — (question_id, texte, is_correct)
- `quiz_attempts` — (quiz_id, user_id, score, completed_at)

RLS deny-by-default partout, RPCs security definer (même discipline que la
marketplace).

---

## 7. Quiz — 2 méthodes de création (sans IA DOUMASSI)

Décision : **le bouton "Génère avec l'IA DOUMASSI" est retiré du scope** (coût
OpenAI trop élevé pour nous). On garde 2 méthodes, toutes deux **gratuites
pour nous** et **sans dépendance à l'épique IA (E5)**.

Principe d'archi : **1 seul modèle de quiz, 2 façons de le remplir**. Les deux
convergent vers le même écran de relecture/édition avant publication.

| Méthode                                    | Coût | Effort user | Dépendance |
| ------------------------------------------ | ---- | ----------- | ---------- |
| ✍️ **Création manuelle** (QCM / vrai-faux) | 0    | élevé       | aucune     |
| 📋 **Colle tes questions**                 | 0    | moyen       | aucune     |

### Détail "Colle tes questions" (idée de l'user)

- On fournit un bouton **"Copier le prompt"** qui met dans le presse-papier un
  prompt cadré (impose NOTRE format exact de sortie).
- L'user colle ce prompt dans SON ChatGPT (ou autre) avec son cours → l'IA
  génère les questions au bon format.
- L'user **colle le résultat** dans un champ texte chez nous (copier-coller,
  pas d'upload de fichier CSV — le paste pardonne mieux les erreurs).
- On **parse + valide** + l'user **relit/corrige** avant publication.

> C'est l'user qui paie l'IA (son compte), pas nous. Version "gratuite pour
> nous" de la génération automatique.

### Règle d'or

On ne publie **jamais** un quiz sans que l'auteur ait relu les questions
(qu'elles soient manuelles ou collées). Garde-fou contre les fausses bonnes
réponses.

### Extension future (hors scope actuel)

Le bouton "✨ Génère avec l'IA DOUMASSI" pourra être rajouté plus tard sans
rien casser (il alimenterait le même modèle de quiz), quand le budget IA le
permettra + que l'infra E5 (proxy OpenAI + extraction PDF) existera.

---

## 8. Communauté — Plan A (émergente)

Pas de système de groupes formels. La communauté naît de l'organisation et de
la contribution :

- Chaque ressource a un **auteur** (profil existant).
- On peut **suivre un auteur** (réutilise le système de follow existant) ou
  **suivre une matière/niveau** (nouveau).
- **Commentaires / entraide** sous les ressources.
- **Réputation** dérivée : nombre de ressources publiées, likes/sauvegardes
  reçus → un contributeur régulier en "Maths Term" devient une référence.

> Le modèle B (groupes dédiés façon Discord/subreddit) est explicitement
> reporté en phase 3+ si le besoin se confirme à l'usage.

---

## 9. Découverte

- **Navigation** : par Niveau → Matière (comme une bibliothèque) + filtre par
  Type.
- **Recherche** : barre de recherche live (titre / description).
- **Grille** de ressources façon marketplace (réutilise `ListingCard`
  adaptée).

---

## 10. Modération (indispensable pour de l'UGC)

- Bouton **Signaler** sur chaque ressource (raison + commentaire).
- Chaque ressource a un **statut** (active / signalée / masquée).
- Review admin léger (au-delà d'un seuil de signalements → masquage auto en
  attente de review).
- Suffisant pour la bêta fermée ; à muscler avant l'ouverture publique.

---

## 11. Ce qu'on réutilise de la marketplace (= faisable vite)

Une ressource a la même forme qu'une annonce → on recopie le pattern éprouvé :

| Marketplace                         | Cours                                      |
| ----------------------------------- | ------------------------------------------ |
| Grille de produits                  | Grille de ressources                       |
| Créer une annonce (upload + champs) | Publier un cours (upload + niveau/matière) |
| Fiche produit                       | Fiche ressource (+ téléchargement)         |
| Filtres + recherche                 | Filtres niveau/matière + recherche         |
| Favoris                             | Sauvegarder une ressource                  |
| Contacter vendeur (DM)              | Contacter l'auteur / entraide              |
| Bucket Storage `listings`           | Bucket Storage `resources`                 |

Le "delta cours" = la taxonomie + le modèle de quiz + la modération.

---

## 12. Découpage en phases

| Phase                 | Contenu                                                                                        | Dépendance                   |
| --------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| **L0 — Bibliothèque** | Taxonomie + publier une ressource + grille + fiche + recherche/filtres + favoris + signalement | aucune (recopie marketplace) |
| **L1 — Quiz**         | Modèle quiz + éditeur manuel + import "colle tes questions" + passer un quiz + score           | aucune (pas d'IA)            |
| **L2 — Communauté**   | Follow matière/auteur + fil dédié + réputation + entraide/commentaires                         | réutilise le social existant |

---

## 13. Proposition de tickets (épique E9 — Cours)

### L0 — Bibliothèque

- **E9-01** Migration taxonomie (`course_levels` + `course_subjects` + seed)
- **E9-02** Migration `resources` + RLS + RPCs (get/detail/create/bookmark)
- **E9-03** Bucket Storage `resources` + policies
- **E9-04** Écran grille ressources (navigation niveau/matière + recherche + filtres)
- **E9-05** Écran fiche ressource (détail + téléchargement + contacter auteur)
- **E9-06** Écran création ressource (formulaire + upload fichiers)
- **E9-07** Favoris ressources
- **E9-08** Signalement + statut modération
- **E9-09** Card COURS cliquable dans Business Hub → `/cours`

### L1 — Quiz

- **E9-10** Migration modèle quiz (quizzes / questions / options / attempts)
- **E9-11** Éditeur de quiz manuel (QCM / vrai-faux)
- **E9-12** Import "colle tes questions" (prompt cadré + parser + validation)
- **E9-13** Passer un quiz + score + historique des tentatives

### L2 — Communauté

- **E9-14** Suivre une matière/niveau + fil dédié
- **E9-15** Réputation auteur (badge dérivé)
- **E9-16** Commentaires / entraide sous ressources

---

## 14. Hors scope (explicitement)

- ❌ Bouton "Génère avec l'IA DOUMASSI" (coût — reporté)
- ❌ Groupes/communautés formels façon Discord (modèle B — phase 3+)
- ❌ Vidéos de cours hébergées (streaming — cf verticales Films/Musique)
- ❌ Certifications / diplômes / parcours structurés
- ❌ Correction automatique d'exercices ouverts (seul le quiz QCM est auto-noté)

---

## 15. Décisions — TRANCHÉES (2026-07-02)

Suite au review croisé (Claude web + vérif code) :

1. **Taxonomie de départ** ✅ — figée en E9-01 (17 niveaux, 10 matières, cf §4).
2. **Réutiliser l'infra sociale vs tables dédiées** ✅ :
   - **Bookmarks** → table dédiée `resource_bookmarks` (mélanger avec les
     bookmarks de posts complexifierait les requêtes de profil).
   - **Commentaires** → table dédiée `resource_comments`. Raison : la table
     `comments` existante n'est PAS polymorphe (elle a un `post_id` en dur +
     est couplée au feed / mentions / notifications / comment_likes). La
     rendre polymorphe serait invasif et risqué.
   - **Notifications** → on étendra l'enum `entity_type` existant (déjà
     polymorphe sur `notifications`) pour "commentaire sur ta ressource".
3. **Nom UI** ✅ — **"Apprendre"** dans les écrans/navigation (couvre cours +
   fiches + exos + annales + quiz), **tuile Business Hub garde "COURS"**
   (fidélité maquette CEO). "Cours" seul sous-estimait le périmètre.
4. **Seuil de signalements** ✅ — **configurable en DB** (paramètre par défaut
   d'une RPC ou table `app_config`), défaut **3**. Jamais hardcodé côté
   client → changer le seuil = migration 30s, pas un release. Intégré en E9-08.
5. **Comportement quiz** ✅ — standard du marché (Quizlet / Duolingo / Anki) :
   **tentatives illimitées** (révision libre) + **meilleur score affiché** sur
   le profil. **Pas de limite quotidienne** (contre-productif pour réviser).
   Tentatives stockées léger (score + date) → pas de souci de volume à
   l'échelle bêta. Intégré en E9-10 / E9-13.

### Réordonnancement L0

E9-09 (card Business Hub cliquable) est **avancée** juste après E9-02/03, pour
avoir un point d'entrée visible dans l'app dès le début du sprint (feedback
CEO plus tôt), quitte à pointer vers une grille encore minimale.

---

_Tickets E9-01 → E9-16 créés (#261 → #276). Prochaine étape : appliquer E9-01
(taxonomie) sur DEV+STAGING, puis attaquer E9-02 (resources + RPCs)._
