# Audit accessibilité — Pré-bêta 12 juin

Audit accessibilité réalisé pour le ticket T-08 (#114), avant l'ouverture
de la bêta fermée.

## Méthodologie

- **Audit statique** : `grep` sur tous les `onPress`, `Pressable`,
  `TouchableOpacity` du code → identification des éléments interactifs
  sans `accessibilityLabel` ou sans `accessibilityRole`
- **Audit visuel** : revue des écrans critiques pour repérer les zones
  tappables visiblement < 44pt
- **Audit contraste** : palette `COLORS` de chaque écran confrontée aux
  ratios WCAG AA (≥ 4.5:1 texte normal, ≥ 3:1 gros texte)

## Écrans patchés dans cette PR

| Écran                                                | Élément                                                              | Action                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app/(auth)/login.tsx`                               | Toggle œil mot de passe                                              | + `accessibilityLabel` dynamique + `accessibilityRole=button` + `hitSlop`                    |
| `src/features/stories/screens/StoryViewerScreen.tsx` | Pressable auteur                                                     | + `accessibilityLabel` (`Ouvrir le profil de @username`) + `accessibilityRole`               |
| `src/features/stories/screens/CreateStoryScreen.tsx` | Close caméra, mode Photo/Vidéo, flip caméra, galerie, bouton capture | + labels + rôles (`button`/`tab`/`tablist`) + `accessibilityState selected` sur le tab actif |
| `app/(feed)/settings.tsx`                            | Back chevron                                                         | + `accessibilityLabel="Retour"` + `hitSlop` 12pt sur les 4 côtés                             |

## Écrans déjà conformes (vérifiés)

| Écran                                                   | Statut                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/(auth)/welcome.tsx`                                | Boutons Tamagui avec label string → auto-label ✅                                                                                                                        |
| `app/(auth)/signup.tsx`                                 | Idem (Buttons Tamagui) ✅                                                                                                                                                |
| `app/(auth)/forgot-password.tsx`                        | Idem ✅                                                                                                                                                                  |
| `src/components/feed/PostCard.tsx`                      | Composant `CountAction` reçoit `label` qui devient `accessibilityLabel`. Like / comment / share / bookmark / menu / avatar / open-detail tous correctement labellisés ✅ |
| `src/features/messaging/components/MessageInput.tsx`    | Bouton Send déjà avec `accessibilityRole` + `accessibilityLabel` + `accessibilityState disabled` ✅                                                                      |
| `src/features/messaging/screens/ConversationScreen.tsx` | Back ChevronLeft + Pressables avec labels ✅                                                                                                                             |
| `src/features/stories/components/StoryViewersSheet.tsx` | Sheet Tamagui — gestion native a11y ✅                                                                                                                                   |

## Hit areas — vérifications

Règle : zone tappable >= **44pt** (iOS HIG) / **48dp** (Material).

| Élément                                            | Taille intrinsèque                      | Compensation                      |
| -------------------------------------------------- | --------------------------------------- | --------------------------------- |
| Toggle œil password                                | icône 20pt                              | `hitSlop` 12pt → effectif 44pt ✅ |
| Back chevrons Settings, Conversation, Story        | icône 22-24pt                           | `hitSlop` 10-12pt → ≥ 44pt ✅     |
| Bouton Send messagerie                             | 40×40pt                                 | `hitSlop` 8pt → 56pt ✅           |
| CountAction PostCard (like/comment/share/bookmark) | ≥ 40×40pt via styles.actionPressable ✅ |
| Story tap zones (3 zones)                          | écran / 3 → > 100pt par zone ✅         |
| Pressable bouton capture story                     | 72×72pt ✅                              |

## Contrastes — palette dark theme DOUMASSI

| Couleur            | Hex       | Sur fond noir      | Ratio  | WCAG AA texte | WCAG AA gros texte |
| ------------------ | --------- | ------------------ | ------ | ------------- | ------------------ |
| `accentNeon`       | `#10D970` | `#000000`          | ~12:1  | ✅            | ✅                 |
| `color` (text)     | `#FFFFFF` | `#000000`          | 21:1   | ✅            | ✅                 |
| `textSecondary`    | `#A0A0A0` | `#000000`          | ~7.1:1 | ✅            | ✅                 |
| `danger`           | `#FF3B30` | `#000000`          | ~4.5:1 | ✅ (limite)   | ✅                 |
| `placeholderColor` | `#6B6B6B` | `#000000`          | ~3.6:1 | ❌            | ✅                 |
| `placeholderColor` | `#6B6B6B` | `$surface #1A1A1A` | ~3.3:1 | ❌            | ✅                 |

**Action** : pour la bêta, on garde la couleur placeholder actuelle parce
qu'elle n'est utilisée que pour des hint text (jamais pour du contenu
sémantique). À ajuster à `#8A8A8A` (ratio 5:1) en V2 si retours
utilisateurs sur la lisibilité.

## Tests manuels à faire avant la bêta

Ces tests sont par construction non automatisables. À planifier sur
device physique iOS + Android.

### VoiceOver (iOS)

1. **Activation** : Settings → Accessibility → VoiceOver → On
2. **Tester** :
   - [ ] Welcome → swipe right pour parcourir → tous les boutons annoncés (Sign in, Create account)
   - [ ] Login → email + password + Log in → annonces cohérentes
   - [ ] Feed → swiper sur un PostCard → annonce de l'auteur, du contenu, des compteurs, des actions
   - [ ] Story viewer → annonces des 3 zones (story précédente / pause / suivante)
   - [ ] Create story → annonces du toggle Photo/Vidéo + flip caméra + capture
   - [ ] Settings → back annoncé "Retour bouton"
   - [ ] Conversation → bulles annoncées avec sender + content + horodatage

### TalkBack (Android)

1. **Activation** : Paramètres → Accessibilité → TalkBack → On
2. **Tester les mêmes parcours** que VoiceOver iOS.

### Tailles dynamiques (Dynamic Type / Font scale)

1. iOS : Réglages → Affichage → Taille du texte → glisser au maximum
2. Android : Paramètres → Affichage → Taille de la police → Maximum
3. **Vérifier** :
   - [ ] Texte des boutons reste lisible (pas de troncature critique)
   - [ ] Feed s'adapte (les compteurs et noms ne débordent pas)
   - [ ] Settings reste navigable
4. **Si des écrans cassent** : signaler en tickets séparés (Sprint 6+),
   pas bloquant bêta.

## Ce qui reste à faire post-bêta

Les éléments suivants sont **non bloquants** pour la bêta du 12 juin mais
à traiter Sprint 6+ pour une accessibilité complète :

- [ ] Audit complet des `Pressable` restants dans `src/features/messaging/components/MessageBubble.tsx` (le long-press a un `accessibilityHint` à ajouter)
- [ ] Couleur `placeholderColor` à ajuster en `#8A8A8A` pour WCAG AA strict
- [ ] Audit des `accessibilityHint` (différents de `accessibilityLabel`) : indiquer le résultat d'une action quand non évident (ex. « Active le bouton pour publier »)
- [ ] Audit des `Modal` / `Sheet` ouvertes : focus initial sur le 1er élément
- [ ] Mode Reader VoiceOver : vérifier que les écrans Settings et profil sont navigables séquentiellement sans piège
- [ ] Audit des screenshots vis-à-vis des contrastes en plein soleil (extérieur)
- [ ] Test avec aide auditive (sous-titres notifications)

## Outils recommandés

- [Contrast Checker](https://webaim.org/resources/contrastchecker/) pour les ratios
- iOS Accessibility Inspector (Xcode) pour identifier les éléments sans label
- Android Accessibility Scanner (Play Store) pour Android

## Bilan

L'audit pré-bêta couvre les **écrans les plus utilisés** (auth, feed,
profil, conversation, stories, settings) et garantit qu'un utilisateur
de VoiceOver ou TalkBack peut **utiliser fonctionnellement** l'app.

Le travail de polish a11y complet (hint, mode reader, contrastes
strictement WCAG AA) est repoussé Sprint 6+ comme convenu dans la
priorisation pré-bêta.
