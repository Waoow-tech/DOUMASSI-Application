# DOUMASSI VISION — Application mobile

Super-app mobile française combinant **réseau social, IA, messagerie privée + appels, marketplace et appels vidéo**. Construite avec **Expo SDK 55**, **React Native 0.83**, **Supabase**, **Tamagui**.

> **Phase 1 — MVP en cours.** Démo interne 5 juin 2026 · Bêta fermée 12 juin 2026.

---

## 🚀 Setup local (5 min)

### Prérequis

- **WSL2 + Ubuntu 24.04** (Windows natif **interdit**, voir CLAUDE.md §Règles strictes)
- **Node 22 LTS**
- **pnpm 10+** (`npm` et `yarn` interdits)
- Un compte **Expo** (créé via GitHub sur [expo.dev](https://expo.dev))
- Un téléphone Android avec autorisation "sources inconnues"

### Premier lancement

```bash
# 1. Cloner
git clone https://github.com/Waoow-tech/DOUMASSI-Application.git
cd DOUMASSI-Application

# 2. Installer (le .npmrc avec shamefully-hoist=true est CRITIQUE)
pnpm install

# 3. Configurer ton env local
cp .env.example .env.local
#    → Demander au CTO les valeurs réelles :
#      - EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Supabase dev)
#      - EXPO_PUBLIC_SENTRY_DSN (optionnel mais recommandé)
#      - EXPO_PUBLIC_POSTHOG_KEY (optionnel mais recommandé)

# 4. Vérifier que tout passe
pnpm typecheck
pnpm lint
pnpm format:check

# 5. Lancer Metro
pnpm start --tunnel    # --tunnel obligatoire en WSL2 à cause du réseau virtualisé
```

### Premier Dev Build Android

Le projet utilise un **Dev Build Expo** (pas Expo Go) car des modules natifs sont requis (Daily.co, Sentry, etc.) :

```bash
pnpm eas:login              # connexion compte Expo
pnpm build:dev:android      # build cloud (~15-30 min)
```

Une fois le build terminé, télécharge l'APK depuis le lien EAS et installe-le sur ton téléphone.

---

## 📜 Commandes utiles

| Commande                     | Effet                                           |
| ---------------------------- | ----------------------------------------------- |
| `pnpm start --tunnel`        | Démarre Metro avec tunnel ngrok (WSL2-friendly) |
| `pnpm typecheck`             | Type checking TypeScript strict                 |
| `pnpm lint`                  | ESLint sur tout le projet                       |
| `pnpm lint:fix`              | Auto-fix les erreurs ESLint                     |
| `pnpm format`                | Auto-format Prettier                            |
| `pnpm format:check`          | Check Prettier (CI-friendly)                    |
| `pnpm build:dev:android`     | Dev Build Android via EAS Cloud                 |
| `pnpm build:preview:android` | APK Android partage interne                     |
| `pnpm build:staging:android` | Build channel staging                           |
| `pnpm build:prod:android`    | Build production (.aab Play Store)              |

---

## 🌳 Workflow Git

- **`main`** — toujours déployable, push direct interdit
- **`dev`** — intégration continue, cible des PR
- **`feature/EX-XX-short-description`** — une branche par ticket GitHub
- **`fix/description`** — correction urgente

**Convention de commit** : [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`).

**PR rules** : 1 approbation min · CI verte obligatoire · `needs-cto-review` requis pour auth/DB/sécurité · squash and merge par défaut.

Voir CLAUDE.md §Workflow Git pour les détails.

---

## 📁 Architecture

```
app/              # Routes Expo Router
src/
  components/     # Composants réutilisables
  features/       # Modules métier (auth, feed, profile, messaging, ai, marketplace)
  hooks/          # Hooks transverses
  lib/            # Client Supabase, env, logger, Sentry, PostHog
  stores/         # Stores Zustand
  types/          # Types TypeScript partagés
  i18n/           # Strings traduites (fr par défaut)
supabase/         # Migrations SQL + Edge Functions
docs/adr/         # ADR (Architecture Decision Records)
```

Détails complets dans [CLAUDE.md](./CLAUDE.md).

---

## 🛠️ Stack technique

Voir [CLAUDE.md §Stack technique figée](./CLAUDE.md#-stack-technique-figée-cadrage-v11) pour la liste exhaustive et les ADR.

---

## 🆘 Dépannage rapide

| Symptôme                                                          | Solution                                                                                                         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Cannot find module '@babel/traverse--for-generate-function-map'` | Vérifier que `.npmrc` contient `shamefully-hoist=true` puis `rm -rf node_modules pnpm-lock.yaml && pnpm install` |
| `[Reanimated] Worklets X not compatible with Reanimated Y`        | `pnpm dlx expo install --check` puis `--fix`. Reanimated 4.3.x ↔ Worklets 0.8.x                                  |
| Metro affiche `172.X.X.X:8081` et le tél ne se connecte pas       | Tu es en WSL2, utilise `pnpm start --tunnel`                                                                     |
| `error while loading shared libraries: libasound.so.2`            | `sudo apt install -y libasound2t64` (ou skip avec `EXPO_NO_DEVTOOLS=1 pnpm start`)                               |
| Le hook pre-commit fail sur lint-staged                           | Lancer `pnpm lint:fix && pnpm format` puis retenter le commit                                                    |

---

## 📚 Documentation

- **CLAUDE.md** (à la racine) — contexte technique complet, conventions, pièges connus
- **Notion workspace** : DOUMASSI VISION — Phase 1 (specs, ADR, runbooks)
- **Cadrage v1.1** (PDF, 55 pages) — référence projet officielle
- **Slack** : `doumassiworkspace.slack.com`

---

## 🎓 Stagiaires

Ton premier ticket Sprint 1 est **`E2-01` Welcome screen**. Avant de coder :

1. Lis la **Charte d'équipe** sur Notion
2. Duplique le **template Onboarding** sur Notion et coche les étapes
3. Suis le setup ci-dessus
4. Fais le warmup en pair-programming avec ton buddy
5. En cas de blocage > 2h → ping `#dev` sur Slack

Voir CLAUDE.md §Note pour les stagiaires pour le détail.

---

_Repo monorepo géré avec pnpm 10. Maintainer : [@Adminabd](https://github.com/Adminabd) (CTO)._
