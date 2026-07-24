# ADR-008 — Mise en relation (matching) + relèvement de l'âge minimum à 15 ans

- **Statut** : Proposé — à valider CTO / CEO
- **Épic** : E13 (Mise en relation)
- **Contexte cadrage** : hors stack figée v1.1 → ADR requis (règle #8) avant tout code.
- **Numérotation** : ADR-006 et ADR-007 sont **réservés** aux phases paiement (cf. ADR-005).

---

## 1. Contexte

Demande initiale du CEO : **un système de matching type Tinder / Happn** dans l'app.

L'analyse du code et du cadrage produit a fait remonter quatre constats déterminants :

1. **L'app accueille des mineurs par design.** Les CGU autorisent l'usage **dès 13 ans**
   (`cgv-fr.ts` §5) et la verticale Cours cible explicitement le **primaire (CP→CM2)**,
   soit des enfants de 6-10 ans.
2. **Aucun contrôle d'âge n'existe.** `birthday` est collecté à l'inscription mais
   **jamais vérifié**, ni côté client ni côté serveur.
3. **La découverte de personnes n'existe pas.** Le seul moyen de trouver quelqu'un est
   `search_users` — une recherche **par nom/pseudo**. Il faut donc déjà connaître la
   personne. Aucune suggestion de profils.
4. **Les briques de mise en relation existent déjà** : `follows` avec
   `status: pending | accepted` (= demande → acceptation), notifications de demandes,
   blocage bilatéral (`blocks`), et `get_or_create_dm` pour la conversation.

Un système de **rencontre amoureuse** dans une app fréquentée par des mineurs, sans
barrière d'âge, présente un risque juridique et de sécurité majeur (mise en relation
adulte↔mineur), et imposerait un reclassement **18+** de l'app entière sur les stores —
incompatible avec une app qui contient de l'éducation.

## 2. Décisions

### 2.1 Le matching est **non-amoureux** — c'est de la *mise en relation*

Objet : trouver un **binôme de révision, un tuteur, un associé, un prestataire** —
pas un partenaire romantique.

Conséquences directes, toutes positives :

| Risque | Avec dating | Décision retenue |
|---|---|---|
| Données art. 9 RGPD (orientation sexuelle) | applicable | **aucune donnée sensible collectée** |
| Gate 18+ + reclassement store | obligatoire | **non nécessaire** (reste 15+) |
| Cohérence avec une app éducation + business | corps étranger | **naturelle** |

### 2.2 Âge minimum de l'app relevé à **15 ans**

Aligné sur la **majorité numérique française** (loi du 7 juillet 2023) : en dessous de
15 ans, le consentement d'un représentant légal est requis. Passer le minimum à 15 ans
évite d'avoir à construire un flux de consentement parental vérifiable.

Implique :
- un **contrôle d'âge côté serveur** (dérivé de `birthday`) — aujourd'hui inexistant ;
- la réécriture des **CGU** et de la **politique de confidentialité** ;
- une **validation juridique** (hors compétence de l'équipe technique).

### 2.3 Taxonomie Cours : retrait du **primaire**

Afficher « Cours de CP » signale qu'on cible des enfants de 6 ans, ce qui contredit des
CGU à 15+. On retire donc les 5 niveaux `primaire` (CP, CE1, CE2, CM1, CM2) et on
**conserve à partir du collège** (un élève de 15+ révise légitimement des bases de 3ᵉ).

> Le niveau du **contenu** ≠ l'âge de l'**utilisateur** : l'obligation porte sur les
> utilisateurs, pas sur le niveau des ressources. D'où le maintien du collège.

**Implémentation** : surtout **pas de `DELETE`** — `resources.level_code` a une clé
étrangère vers `course_levels`. On ajoute un flag **`is_active`** sur `course_levels`,
mis à `false` pour le primaire, et on filtre partout. Aucune migration de données à
prévoir : aucune ressource réelle n'a encore été publiée (données de test uniquement).

### 2.4 Mécanique : **demande → acceptation** (style LinkedIn), pas swipe double-aveugle

On réutilise la machinerie `follows` (`pending`/`accepted`) déjà en place plutôt que
d'introduire un modèle de « like » double-aveugle.

Raisons : (a) une demande de contact est socialement banale, y compris entre mineurs,
alors qu'un swipe sur des visages **est** une app de rencontre quel que soit son nom ;
(b) c'est le chemin le moins coûteux (le flux existe déjà).

### 2.5 Le cœur du produit : **l'intention déclarée**

C'est la décision structurante. Ni le swipe, ni la suggestion, ni la demande ne créent
de valeur seuls : **sans intention déclarée, une suggestion est du bruit et un swipe
n'est que des visages.**

Le produit est donc : *« je déclare ce que je cherche / ce que je propose, et l'app me
montre les personnes dont l'intention correspond »*.

**UI** : une **liste** « ces personnes cherchent la même chose que toi » suffit.
Si le CEO tient au ressenti Tinder, on peut swiper — mais sur des **cartes d'intention**
(« cherche un binôme en maths 1ʳᵉ »), **jamais sur des visages plein écran**. Même coût
de développement, risque produit évité.

### 2.6 Périmètre : **scolaire ET business** (option C)

- **Scolaire** : matière × niveau → réutilise `course_subjects` × `course_levels`.
- **Business** : compétences / secteur → **taxonomie inexistante**. Pragmatique v1 :
  **tags libres** (`text[]`) avec une courte liste suggérée, plutôt que de construire
  une taxonomie de compétences complète. À faire évoluer si l'usage décolle.

### 2.7 Sécurité : opt-in + segmentation par âge

Deux règles non négociables, appliquées **côté serveur** :

1. **Opt-in explicite** — personne n'est visible dans la mise en relation par défaut.
2. **Segmentation par tranche d'âge** — les **mineurs ne voient que des mineurs**, les
   majeurs que des majeurs. Beaucoup plus léger qu'un gate 18+, mais indispensable dès
   lors que l'app accueille des 15-17 ans.

+ blocages (existants, à respecter dans les deux sens) et signalement.

## 3. Modèle de données proposé

```sql
-- Une ligne PAR intention (un user peut en avoir plusieurs).
matching_intents (
  id           uuid primary key,
  user_id      uuid references profiles(id) on delete cascade,
  domain       text check (domain in ('scolaire','business')),
  direction    text check (direction in ('cherche','propose')),
  -- scolaire
  subject_code text references course_subjects(code),
  level_code   text references course_levels(code),
  -- business
  tags         text[],
  note         text,              -- courte description libre
  is_active    boolean default true,
  created_at   timestamptz default now()
)
```

- **Opt-in** : porté par un flag sur `profiles` (ou l'existence d'au moins une intention active).
- **RPC de découverte** `get_matching_candidates(...)` — `security definer`, qui exclut :
  soi-même, les profils non opt-in, les utilisateurs **bloqués dans les deux sens**, et
  applique la **segmentation d'âge** (calculée depuis `birthday`, côté serveur).
- **Mise en relation** : `follows` (pending → accepted) puis `get_or_create_dm`. **Zéro code neuf.**
- **RLS deny-by-default** sur `matching_intents` ; écriture limitée à ses propres intentions.

## 4. Ce qu'on réutilise (et qui rend le chantier petit)

| Brique | Statut |
|---|---|
| Demande → acceptation (`follows` pending/accepted) | ✅ existe |
| Notifications de demandes | ✅ existe |
| Blocage bilatéral (`blocks`) | ✅ existe |
| Conversation au contact (`get_or_create_dm`) | ✅ existe |
| Taxonomie matières × niveaux | ✅ existe |
| Profils (avatar, bio, `birthday`, `gender`) | ✅ existe |

Le travail réel se concentre sur : **la déclaration d'intention** et **l'écran de découverte**.

## 5. Conséquences

**Positives**
- Répond au besoin du CEO (découverte de personnes, mécanique engageante) **sans** créer
  une app de rencontre.
- Comble un manque réel : aujourd'hui la découverte de personnes **n'existe pas**.
- Chantier petit grâce à la réutilisation massive.
- **Puits naturel pour les Dcoins** (mettre en avant son intention) — ce qui manquait à
  l'économie du wallet (ADR-005).

**Risques / vigilance**
- **Dérive d'usage** : même non-amoureux, un outil de mise en relation peut être détourné.
  D'où : intention obligatoire, pas de swipe sur visages, signalement, segmentation d'âge.
- Le relèvement à 15 ans **ampute une partie du public visé** initialement par Cours.
- Le contrôle d'âge et la réécriture CGU sortent du périmètre technique → **juridique requis**.

## 6. Alternatives écartées

- **Tinder / Happn complet** → risque juridique majeur (mineurs), reclassement 18+, géoloc
  très sensible (aucune géoloc n'existe aujourd'hui dans l'app).
- **Simples suggestions de profils (Instagram)** → sans intention déclarée, suggestions
  aléatoires ; ne répond pas au besoin de *mise en relation*.
- **Swipe double-aveugle non-amoureux** → conserve l'apparence d'une app de rencontre.

## 7. Découpage E13 proposé

- **E13-01** — Âge : contrôle serveur 15+ (depuis `birthday`) + CGU/confidentialité (⚠️ juridique).
- **E13-02** — Cours : `is_active` sur `course_levels`, désactivation du primaire, filtrage.
- **E13-03** — Schéma `matching_intents` + RLS + opt-in.
- **E13-04** — RPC `get_matching_candidates` (exclusions + **segmentation d'âge**).
- **E13-05** — Écran « Déclarer mon intention » (scolaire / business).
- **E13-06** — Écran découverte « cherchent la même chose que toi » + contact (follow + DM).
- **E13-07** — Signalement + garde-fous anti-abus (rate limit sur les demandes).
- *(Plus tard : mise en avant d'une intention payée en Dcoins — puits.)*

## 8. Hors scope

- ❌ Géolocalisation / « vous vous êtes croisés » (Happn) — aucune géoloc n'existe ;
  donnée très sensible, permission lourde. À réévaluer plus tard, jamais en v1.
- ❌ Algorithme de recommandation sophistiqué — v1 = correspondance simple sur l'intention.
- ❌ Taxonomie de compétences complète (v1 = tags libres).

---

*À valider par le CTO et le CEO. Le point 2.2 (âge 15 ans) nécessite en plus une
validation juridique avant mise en production.*
