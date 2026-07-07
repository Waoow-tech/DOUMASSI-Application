# Brief de scope — Verticale JEUX (épique E10)

> Cadrage de la verticale "Jeux" du Business Hub DOUMASSI.
> Statut : validé CTO. Rédigé le 2026-07-04.
> Nouvelle verticale hors cadrage Phase 1 v1.1 (cf CLAUDE.md règle #8).

---

## 1. Vision

Des **mini-jeux jouables directement dans l'app** — des classiques addictifs
que tout le monde connaît, avec **scores et classements** pour l'engagement.

Contrairement à Marketplace et Cours (catalogues UGC où les users publient),
les jeux sont **curatés par nous** (fournis par l'app). Raison : laisser des
users uploader du JS arbitraire serait une faille de sécurité majeure.

## 2. Architecture technique

Pattern standard "mini-jeux dans une app RN" :

1. Chaque jeu = un **fichier HTML5 auto-contenu** (Canvas + JS inline, quelques
   Ko), écrit maison, thémé DOUMASSI (fond noir, vert neon `#10D970`).
2. Affiché dans une **WebView** (`react-native-webview`, ajouté E10-01).
3. Le jeu communique avec l'app via `postMessage` :
   - `{ type: 'score', value: N }` → l'app enregistre le score
   - `{ type: 'ready' }`, `{ type: 'gameover' }` → cycle de vie optionnel
4. HTML passé en `source={{ html }}` (inline string) → **offline, pas
   d'hébergement**, cross-platform robuste.

### Pourquoi pas de génération IA externe (Gemini)

On écrit les jeux nous-mêmes : contrôle qualité, zéro coût, zéro dépendance,
cohérence visuelle. Les classiques ciblés sont simples et fiables à coder.

### Registry des jeux

Un tableau TS en dur `GAMES: GameDef[]` (id, titre, description, couleur
d'accent, icône, html). `game_id` = string stable (`'2048'`, `'snake'`…).
Pas de table DB pour les jeux (curatés). Les scores référencent le `game_id`.

## 3. Sécurité

- Jeux **curatés uniquement** (pas d'UGC de code).
- WebView sandboxée : `javaScriptEnabled` oui, mais pas d'accès réseau utile
  (jeux auto-contenus), pas de `allowFileAccess` superflu.
- Scores : le jeu envoie un score via postMessage → **potentiellement
  falsifiable** (le client contrôle le JS). Pour un MVP de jeux fun, c'est
  acceptable (pas d'enjeu monétaire). Si un classement devient sensible, on
  ajoutera de la validation (bornes de score plausibles côté RPC).

## 4. Licences / nommage

Mécaniques libres uniquement. On évite les marques déposées.

- **2048** : open-source MIT (Gabriele Cirulli)
- **Snake**, **Memory**, **Casse-briques**, **Démineur**, **Morpion** :
  mécaniques du domaine public
- **Envol** : mécanique "tap-to-fly" (générique, PAS le nom "Flappy Bird")
- **Course** : jeu de véhicule original (esquive de trafic)

## 5. Les 6 jeux du L0

| Jeu               | Mécanique                                  | Contrôle mobile               |
| ----------------- | ------------------------------------------ | ----------------------------- |
| **2048**          | Fusion de tuiles                           | Swipe                         |
| **Snake**         | Serpent qui grandit                        | Swipe / boutons directionnels |
| **Memory**        | Retrouver les paires                       | Tap                           |
| **Casse-briques** | Raquette + balle + briques                 | Drag horizontal               |
| **Envol**         | Tap-to-fly, éviter les obstacles           | Tap                           |
| **Course** 🚗     | Véhicule vue de dessus, esquiver le trafic | Drag / tap gauche-droite      |

Extensible : on ajoute d'autres jeux plus tard (démineur, puissance 4,
morpion…) sans refactor — juste une entrée de plus dans le registry.

## 6. Scores & classements

- Table `game_scores` (user_id, game_id, score, created_at)
- Meilleur score perso affiché sur l'écran de jeu + le catalogue
- Classement (leaderboard) top N par jeu
- Tentatives illimitées, meilleur score retenu (cohérent avec le quiz Cours)

RPCs : `submit_game_score`, `get_my_best_game_score`, `get_game_leaderboard`.

## 7. Écrans

- **`/games`** — catalogue (grille de jeux + meilleur score perso par jeu).
  La tuile "JEUX" du Business Hub y mène.
- **`/games/[id]`** — écran de jeu : WebView plein écran + header (retour,
  meilleur score, classement) + soumission auto du score en fin de partie.

## 8. Ce qu'on réutilise

- Pattern grille + FlashList (marketplace/cours)
- Pattern RPC security definer + best-score (quiz E9-10/13)
- Business Hub (E7-17) : rendre la tuile Jeux active

## 9. Découpage en tickets (épique E10 — Jeux)

- **E10-01** Ajout react-native-webview + migration `game_scores` + RPCs
- **E10-02** Composant GameWebView (bridge postMessage ↔ score) + registry
- **E10-03** Écran catalogue `/games` + tuile Business Hub cliquable
- **E10-04** Écran de jeu `/games/[id]` (WebView + meilleur score + classement)
- **E10-05** Jeu 2048
- **E10-06** Jeu Snake
- **E10-07** Jeu Memory
- **E10-08** Jeu Casse-briques
- **E10-09** Jeu Envol (tap-to-fly)
- **E10-10** Jeu Course (véhicule)

## 10. Hors scope

- ❌ Jeux uploadés par les users (UGC de code — sécurité)
- ❌ Multijoueur temps réel
- ❌ Jeux natifs (moteur type Unity/Skia) — WebView suffit pour des classiques
- ❌ Achats in-game / monétisation
- ❌ Anti-triche fort sur les scores (acceptable pour du fun MVP)

## 11. Pré-requis

- **Rebuild EAS** (react-native-webview est natif) — à grouper avec le rebuild
  document-picker + le build preview.

---

_Après validation : créer E10-01 → E10-10, puis attaquer E10-01 (WebView +
scores DB)._
