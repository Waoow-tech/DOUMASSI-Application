# CLAUDE.md — DOUMASSI VISION Phase 1

> Ce fichier est lu automatiquement par Claude Code au démarrage. Il donne le contexte minimum nécessaire pour travailler sur ce projet sans erreur.

---

## 🎯 Contexte projet

**Produit** : DOUMASSI VISION — super-app mobile française combinant réseau social, IA, messagerie, marketplace et appels.

**Phase actuelle** : Phase 1 (MVP)

**Deadlines** :
- Démo interne : 5 juin 2026
- Bêta fermée TestFlight + Play Internal : 12 juin 2026

**Équipe** : 4 ETP
- 1 CTO (Abdou)
- 2 stagiaires
- 2 renforts plein temps

**Sprint actuel** : Sprint 1 — Auth & Onboarding (28 avr - 2 mai 2026). Sprint 0 livré le 27 avril (E1-02, E1-04, E1-05, E1-13, E1-14, E1-17 ✅).

---

## 🛠️ Stack technique figée (cadrage v1.1)

> Ces choix sont validés et non négociables sans ADR. Si tu veux dévier, propose un ADR avant.

### Mobile
- **Expo SDK 55** avec **Dev Build** obligatoire (Daily.co Sprint 5-6 requiert modules natifs) — voir ADR-003
- **React 19.2.0 + React Native 0.83.6** (cibles SDK 55)
- **TypeScript strict** (`strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`)
- **Expo Router 55.x** (file-based, deep linking gratuit) — `bundleId: com.doumassi.app`, `scheme: doumassi`
- **Tamagui `1.135.5`** comme UI Kit (ADR-001). Pas de v2 RC tant que pas GA — voir ADR-004
- **TanStack Query** pour le state serveur
- **Zustand** pour le state client global
- **React Hook Form + Zod** pour les formulaires
- **FlashList** (Shopify) pour les listes virtualisées
- **lucide-react-native** pour les icônes
- **expo-image-picker, expo-camera, expo-audio, expo-video, expo-image, expo-notifications** (`expo-av` deprecated SDK 53+)

### Backend
- **Supabase** (Auth + Postgres + RLS + Storage + Realtime + Edge Functions + pgvector + pg_cron)
- **Vercel** pour landing/web futur

### IA
- **OpenAI** : GPT-4o, o3-mini, DALL-E 3, Whisper, text-embedding-3-small
- **Mistral** en fallback
- **Tavily** pour la web search (Tier 3 Studio AI)

### Appels
- **Daily.co** SDK `@daily-co/react-native-daily-js`

### Monitoring
- **Sentry** pour les crashes
- **PostHog** pour les events produits + monitoring coûts API

### Outils
- **GitHub** monorepo
- **GitHub Actions** pour CI/CD
- **EAS Build** pour builds iOS/Android
- **pnpm** comme package manager (jamais npm ni yarn)
- **Notion** pour la doc non-code
- **Slack** workspace `doumassiworkspace.slack.com`

---

## 📁 Architecture de dossiers (cadrage §2.3)

```
doumassi-mobile/
├── app/                      # Routes Expo Router
├── src/
│   ├── components/           # Composants réutilisables
│   ├── features/             # Modules métier (auth, feed, profile, messaging, ai, marketplace)
│   ├── hooks/                # Hooks custom (useAuth, useFeed, etc.)
│   ├── lib/                  # Client Supabase, OpenAI proxy, utils
│   ├── stores/               # Stores Zustand
│   └── types/                # Types TypeScript partagés
├── assets/                   # Images, fonts, icônes
├── supabase/                 # (futur monorepo)
│   ├── migrations/           # Migrations SQL
│   ├── functions/            # Edge Functions
│   └── seed.sql
├── .github/workflows/        # CI/CD
└── docs/                     # Uniquement les ADR (le reste sur Notion)
```

---

## 🗄️ Environnements Supabase

| Env | Project Ref | URL | Usage |
|---|---|---|---|
| **dev** | `kbysmkhalnolbsojzahf` | `https://kbysmkhalnolbsojzahf.supabase.co` | Tous les devs travaillent ici |
| **staging** | `sdapojfdwduhuyduymxk` | `https://sdapojfdwduhuyduymxk.supabase.co` | Recette équipe + CTO |
| **prod** | (pas encore créé) | — | Sera créé avant la bêta fermée |

**Schéma déjà déployé** : 21 tables (`profiles`, `posts`, `messages`, `ai_conversations`, `listings`, etc.), RLS activée partout, 8 Storage buckets, 3 jobs pg_cron.

**Anon key dev** : disponible dans `.env.example` (à créer). Cette clé est volontairement publique, c'est la RLS qui protège.

**Service role** : JAMAIS dans le code. Uniquement dans GitHub Actions secrets ou Supabase Vault.

---

## 📝 Conventions de code

### TypeScript
- Strict mode obligatoire
- Pas de `any` sans justification (utiliser `unknown` puis narrow)
- Types partagés client/serveur via Zod schemas

### Styles
- ESLint 9 (`eslint-config-expo` flat config) + Prettier 3 configurés
- Husky pre-commit hook : lint-staged (eslint --fix + prettier --write)
- Lignes max 100 caractères
- `'use strict'` jamais (TypeScript le fait)

### Pièges pnpm + Expo SDK 55 (à connaître absolument)
- **`.npmrc` DOIT contenir `shamefully-hoist=true`** + `node-linker=hoisted`. Sans ça, Metro plante sur l'alias npm `@babel/traverse--for-generate-function-map` utilisé par `metro-source-map`. Ne JAMAIS supprimer ces lignes du `.npmrc`.
- **`react-native-reanimated` ↔ `react-native-worklets` doivent matcher**. Reanimated 4.3.x exige Worklets `0.8.x`. Reanimated 4.2.x exige Worklets `0.7.x`. Si tu update l'un, vérifie l'autre via `pnpm dlx expo install --check`.

### Imports
- Imports absolus via `@/` alias (config dans `tsconfig.json` + `babel.config.js`)
- Ordre : externes → internes (`@/`) → relatifs (`./`)

### Naming
- **Composants** : PascalCase (`PostCard.tsx`)
- **Hooks** : camelCase préfixé `use` (`useFollow.ts`)
- **Stores Zustand** : camelCase suffixé `Store` (`authStore.ts`)
- **Types** : PascalCase (`Profile`, `MessageAttachmentType`)
- **Constantes** : UPPER_SNAKE_CASE (`MAX_POST_LENGTH`)

### Commits (Conventional Commits)
```
feat(auth): ajouter le bouton OAuth Google
fix(feed): corriger la pagination qui sautait une page
chore(ci): augmenter le timeout des tests
docs(adr): ADR-002 choix de Daily.co
refactor(profile): extraire le hook useProfileForm
```

---

## 🌳 Workflow Git

### Branches
- `main` — toujours déployable, **protégée**, push direct interdit
- `dev` — intégration continue (cible des PR features), **protégée** (pas de force-push)
- `feature/EX-XX-short-description` — une branche par ticket
- `fix/description` — correction urgente

### Config git recommandée (à lancer après le `git clone`)

```bash
# Évite les rebase/merge implicites quand `git pull` rencontre une divergence.
# git refusera plutôt et demandera d'expliciter (--rebase ou --no-rebase).
# Sans ça, on peut accidentellement ressusciter de vieux commits d'un précédent rebase.
git config pull.ff only
```

### PR Rules
- **1 approbation minimum** requise
- **CI verte obligatoire** (lint + typecheck + tests + build)
- Tickets touchant **auth/DB/sécurité** → label `needs-cto-review` requis
- **Squash and merge** par défaut
- Délai max review : **24h ouvrées**
- Les stagiaires peuvent approuver entre eux **sauf** les sujets sensibles ci-dessus

---

## ⚠️ Règles strictes de l'équipe

1. **Pas de Windows natif**. Si Windows → WSL2 + Ubuntu obligatoire.
2. **Le projet vit dans `~/projets/DOUMASSI-Application`** sous WSL, jamais dans `/mnt/c/...`
3. **Jamais de clé API dans le client mobile**. Toutes les clés sensibles passent par les Edge Functions Supabase.
4. **RLS deny-by-default** sur toutes les tables. Toute nouvelle table doit avoir RLS activée + policies explicites.
5. **Tests requis** :
   - Logique métier → 70% de couverture
   - Hooks custom → 50% de couverture
   - Composants UI → tests d'intégration des écrans critiques
6. **Pas de `console.log` en production**. Utiliser le wrapper logger qui passe par Sentry.
7. **Tout secret va dans `.env.local`** (gitignored), jamais hardcodé.
8. **Si une décision sort du cadrage, créer un ADR avant d'agir** — pas après.

---

## 🎯 Sprint 0 — Bilan (livré 27 avril 2026)

**Tickets E1 complétés :**
- ✅ Cadrage v1.1 livré (55 pages)
- ✅ Repo GitHub créé + 114 tickets + labels + milestones
- ✅ Slack workspace + 10 canaux + charte
- ✅ Notion workspace structuré + 6 templates
- ✅ Supabase dev + staging déployés (21 tables, RLS, Storage, cron)
- ✅ Node 22 LTS installé dans WSL
- ✅ **E1-02** Projet Expo SDK 55 initialisé + TypeScript strict + ESLint 9 + Prettier + Husky
- ✅ **E1-04** Stack applicative installée (Tamagui v1.135.5, TanStack Query, Zustand, Zod, RHF, Supabase JS, Sentry, PostHog, FlashList, lucide, Expo Router)
- ✅ **E1-05** Tamagui thème dark provisoire (palette ADR-002, à raffiner Sprint 1)
- ✅ **E1-13** Templates GitHub (feature/bug/tech/PR/CODEOWNERS)
- ✅ **E1-14** Sentry + PostHog wire-up (init conditionnel — DSN dans `.env.local`)
- ✅ **E1-17** Splash screen DOUMASSI (vert neon `#10D970` sur fond noir)
- ✅ EAS Build configuré (Android-only Sprint 0, iOS Sprint 5-6)
- ✅ Dev Build Android testé sur device physique via tunnel ngrok

**Reste pour clore l'Epic E1 (Sprint 1 ou plus tard) :**
- ⏳ **E1-11** Pipeline CI GitHub Actions (lint + typecheck + tests + build)
- ⏳ **E1-15** Monitoring coûts API + alertes Slack
- ⏳ **E1-16** Templates Notion (déjà fait par CTO hors code)

---

## 📚 Documentation de référence

- **Notion workspace** : DOUMASSI VISION — Phase 1 (sous HOME PAGE)
  - 🤝 Charte d'équipe
  - 📅 Sprint 0 Planning
  - 🔧 Architecture & Tech → ADR-001 Tamagui
  - 📖 Glossaire technique
  - 📋 Templates (Spec, ADR, CR Sprint, Rétro, Post-mortem, Onboarding)
- **Slack** : `doumassiworkspace.slack.com`
  - `#general` — annonces + charte épinglée
  - `#dev` — discussions techniques
  - `#dev-prs` — flux automatique PR
  - `#dev-builds` — flux automatique builds
  - `#dev-incidents` — alertes prod
  - `#produit` `#ia` `#messaging` — channels épiques
- **GitHub** : `Waoow-tech/DOUMASSI-Application`
  - 8 milestones (Sprint 0 → Sprint 7 + MVP)
  - 26 labels (type:, priority:, epic:, etc.)
  - 114 tickets répartis sur 8 épiques

---

## 🤖 Style de réponse attendu de Claude Code

1. **Explique POURQUOI**, pas juste QUOI. Surtout pour aider les stagiaires à apprendre.
2. **Vérifie avant d'exécuter** une commande destructive (`rm -rf`, `drop`, `force push`, etc.) — toujours demander confirmation.
3. **Code commentaires en français**, noms techniques en anglais (variables, fonctions, types).
4. **Une seule action à la fois** quand on est en phase setup. Pas de mega-script qui fait 15 trucs d'un coup.
5. **Si une erreur survient**, lis attentivement le message, ne devine pas. Propose un diagnostic puis une solution.
6. **Si tu penses qu'une décision sort du cadrage**, signale-le explicitement et propose de créer un ADR avant.
7. **Pas de packages random**. Si tu veux ajouter une lib qui n'est pas dans la stack figée, justifie-le et propose un ADR.

---

## 🎓 Note pour les stagiaires

Si tu es un stagiaire qui lit ce fichier :
- Bienvenue sur DOUMASSI VISION 🎉
- Lis d'abord la **Charte d'équipe** sur Notion
- Duplique le **template Onboarding nouveau dev** sur Notion et coche au fur et à mesure
- Ton premier ticket Sprint 1 est `E2-01` (Welcome screen) sur GitHub
- **Avant de coder** :
  1. `pnpm install` à la racine (le `.npmrc` est critique, ne pas le supprimer)
  2. Copier `.env.example` → `.env.local` et demander au CTO les vraies clés Supabase + DSN Sentry + PostHog API key
  3. `pnpm dlx eas login` avec ton compte Expo (créé via GitHub) → `pnpm build:dev:android` pour ton 1er Dev Build
  4. Installer le Dev Build sur ton tél, lancer `pnpm start --tunnel` (WSL2 = tunnel obligatoire)
- En cas de blocage > 2h, ping ton buddy ou le CTO sur Slack — c'est dans la charte

---

*Dernière mise à jour : 27 avril 2026 (post-Sprint 0)*
*Version cadrage de référence : v1.1*
*ADR additionnels : ADR-003 (Expo SDK 55), ADR-004 (Tamagui v1 vs v2 RC)*
