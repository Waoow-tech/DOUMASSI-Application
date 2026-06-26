# Audit accessibilité post-bêta — résultats

Suite du ticket [#215](https://github.com/Waoow-tech/Application/issues/215). Couvre les éléments **automatisables** (contrastes, hints, labels). Les éléments **manuels** (VoiceOver, Dynamic Type, Accessibility Scanner) doivent être joués sur device et leurs findings reportés ici au fur et à mesure.

## ✅ Fix appliqués dans la PR

### Contrastes WCAG AA

| Fichier                                  | Avant     | Après     | Ratio                         |
| ---------------------------------------- | --------- | --------- | ----------------------------- |
| `MessageBubble.tsx` `COLORS.deletedText` | `#6B6B6B` | `#8A8A8A` | ~3.3:1 → ~4.7:1 sur `#1A1A1A` |

Le `$placeholderColor` du thème Tamagui était déjà à `#A0A0A0` (= `textSecondary`) et conforme WCAG AA — pas de changement nécessaire malgré ce qui est noté dans le ticket initial (la valeur `#6B6B6B` n'existait que sur `MessageBubble.deletedText`, pas dans le thème).

### `accessibilityHint`

| Composant                           | Action           | Hint ajouté                                                  |
| ----------------------------------- | ---------------- | ------------------------------------------------------------ |
| `PostCard` — `CountAction`          | (prop ajoutée)   | `hint?: string` → propagée à `accessibilityHint`             |
| `PostCard` Like                     | toggle           | "Tap pour aimer ce post" / "Tap pour retirer votre like"     |
| `PostCard` Bookmark                 | toggle           | "Tap pour sauvegarder…" / "Tap pour retirer…"                |
| `StoryViewerScreen` Tap zone gauche | story précédente | "Tap pour revenir à la story précédente"                     |
| `StoryViewerScreen` Tap zone milieu | pause/reprise    | "Tap pour mettre en pause" / "Tap pour reprendre la lecture" |
| `StoryViewerScreen` Tap zone droite | story suivante   | "Tap pour passer à la story suivante"                        |
| `StoryViewerScreen` "Vu par"        |                  | "Voir la liste des personnes ayant vu cette story"           |
| `FeedStories` "Votre story"         | créer            | "Tap pour créer une nouvelle story"                          |
| `FeedStories` story autre user      | visionner        | "Tap pour visionner la story de @{username}"                 |

## ⏳ À tester manuellement sur device

### Mode Reader VoiceOver (iOS)

- [ ] **Feed → PostCard** : navigation séquentielle (swipe droite) doit ordonner correctement : avatar → nom → contenu → médias → compteurs → actions
- [ ] **Settings** : chaque section doit être annoncée comme un heading (déjà à valider une fois `accessibilityRole="header"` ajouté — chantier follow-up car nécessite de toucher Settings screen en profondeur)

### TalkBack (Android)

- [ ] Mêmes parcours que VoiceOver — comportement attendu identique

### Dynamic Type / Font scale

- [ ] iOS : Réglages → Accessibilité → Affichage du texte → Plus grand texte → maximum (`UIContentSizeCategory.AccessibilityExtraExtraExtraLarge`)
- [ ] Android : Réglages → Affichage → Taille de la police → maximum
- [ ] Vérifier que **les tab labels** ne sont pas tronqués
- [ ] Vérifier que **les boutons de toolbar** (composer post, message input) ne dépassent pas
- [ ] Vérifier que **les notifications** restent lisibles
- [ ] Si écran cassé → ouvrir un ticket bug ciblé (référencer ce doc)

### Accessibility Scanner (Android, gratuit, Play Store)

- [ ] Lancer sur les écrans : Welcome, Feed, Profile (mien), Profile (autre), Story Viewer, Conversation, Settings, Create Post
- [ ] Rapporter les findings ici

## Hors scope (notés pour V3)

- Support TalkBack avec gestes custom (swipe droite/gauche pour stories)
- Audit dimensions hit area (RGAA exige ≥ 44×44 pt) — couverture spot check seulement pour la bêta
- Animations qui respectent `prefers-reduced-motion` (RN-level)
- Labels traduits dynamiquement (pour l'instant tout est FR via i18n)
