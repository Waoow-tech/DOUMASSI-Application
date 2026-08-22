# Brief de scope — Internationalisation FR/EN (épique E11)

> Cadrage de l'i18n (choix de langue français/anglais).
> Statut : validé CTO (2026-07-08). Hors cadrage Phase 1 initial (règle #8).

---

## 1. Problème

- L'i18n actuelle est un **stub** : `src/i18n/index.ts` fait `export const t = fr`
  → langue **câblée en dur**, aucun choix possible.
- `src/i18n/fr.ts` (malgré son nom) **mélange anglais et français** : la section
  `auth` est en anglais, `profile` en français. → **c'est la cause du "mélange"**
  visible (login/inscription en EN, reste en FR).
- **~105 fichiers .tsx sur 123** ont du texte **français écrit en dur** (pas via
  i18n). Le système i18n n'est utilisé que par **19 fichiers**.

## 2. Objectif

1. **Ne plus imposer la langue** : détecter la langue du téléphone au 1er
   lancement, laisser l'utilisateur choisir.
2. **Choix FR / EN** dans les Réglages, persistant.
3. **Traduire toute l'app** (les ~105 fichiers) → chaque écran dispo en FR et EN.

## 3. Architecture choisie : i18n store-based (Zustand)

Plutôt qu'i18next (lourd, namespaces, config), on garde l'ergonomie objet
existante (`t.section.key`) mais rendue **réactive** via un store Zustand.

- **`src/stores/languageStore.ts`** — Zustand + persist (AsyncStorage).
  `language: 'fr' | 'en'`. Défaut = langue du téléphone (expo-localization),
  fallback FR. `setLanguage()` marque un choix explicite.
- **`src/i18n/fr.ts` + `src/i18n/en.ts`** — dictionnaires de même forme.
  `type Translations = typeof fr` ; `en: Translations` garantit que EN couvre
  exactement les mêmes clés (erreur de compil si une clé manque).
- **`src/i18n/index.ts`** :
  - `useTranslations(): Translations` — hook **réactif** (composants) →
    `const t = useTranslations(); t.section.key`
  - `getT(): Translations` — accès **non-réactif** (hooks/libs hors composant).

Avantages : migration minimale (les call sites `t.x.y` changent peu), réactif
au changement de langue, typé (une clé manquante en EN = erreur TypeScript).

## 4. Détection & persistance

- 1er lancement : `expo-localization.getLocales()[0].languageCode` → 'en' → EN,
  sinon FR. **Donc on n'impose plus.**
- L'utilisateur peut surcharger via Réglages → persisté (AsyncStorage).

## 5. Découpage en tickets (épique E11)

- **E11-01** Infrastructure : store langue + détection + toggle Réglages +
  `fr.ts`/`en.ts` + migration des sections existantes (auth/profile/splash,
  en corrigeant le FR/EN mélangé) + migration des 19 fichiers actuels.
- **E11-02** Traduction Feed / Social (feed, posts, stories, Business Hub).
- **E11-03** Traduction Profil (écrans + édition + followers/following).
- **E11-04** Traduction Messagerie + Appels.
- **E11-05** Traduction Notifications.
- **E11-06** Traduction Marketplace.
- **E11-07** Traduction Cours (Apprendre + quiz + entraide).
- **E11-08** Traduction Jeux (catalogue + écran de jeu + classement).
- **E11-09** Traduction composants partagés + erreurs + divers restants.

## 6. Règles de traduction

- Clés **stables** partagées FR/EN. Valeurs propres dans chaque langue.
- Interpolation simple via fonctions dans le dico si besoin
  (`resources: (n) => n > 1 ? '…' : '…'`).
- On garde le **tutoiement** en FR (cohérent avec l'existant).
- Les strings des **fichiers HTML des jeux** (E10) restent en dur pour le MVP
  (peu de texte, dans la WebView) — à traduire plus tard si besoin.

## 7. Hors scope

- ❌ Autres langues que FR/EN (pour l'instant).
- ❌ Traduction des **dialogues système** (permissions, partage, dates) — ils
  suivent la langue de l'OS, un toggle in-app ne les change pas. Documenté pour
  éviter la fausse attente.
- ❌ Traduction du contenu **utilisateur** (posts, annonces…) — seule l'UI est
  traduite, pas ce que les gens écrivent.

## 8. Note d'effort

C'est le **plus gros refactor de l'app** (~105 fichiers). E11-01 pose la
fondation et corrige le mélange auth ; E11-02→09 sont de l'extraction de
strings répétitive, zone par zone. Candidat idéal à une exécution parallèle
(workflow multi-agents) si on veut accélérer.

---

_Prochaine étape : E11-01 (infra + fondation), puis extraction zone par zone._
