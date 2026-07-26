# DOUMASSI VISION — État de l'app au 29 juin 2026

> Document à utiliser comme **brief de contexte** pour une discussion stratégique avec un LLM externe (Claude.ai web, autre modèle conseil, board, etc.). À jour à la fin du Sprint 6 + Sprint 7 (appels).

---

## 1. Identité du projet

| Champ                       | Valeur                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Nom**                     | DOUMASSI VISION                                                                            |
| **Pitch**                   | Super-app française combinant réseau social, messagerie, appels, IA, marketplace et wallet |
| **Phase actuelle**          | Phase 1 MVP — Sprint 7 en cours                                                            |
| **Équipe**                  | 1 CTO (Abdou) + 2 stagiaires + 2 renforts (4 ETP)                                          |
| **Deadlines initiales**     | Bêta fermée 12 juin 2026 ❌ dépassée, en flexible                                          |
| **Statut commercial**       | Pré-bêta, 0 utilisateur externe à ce jour                                                  |
| **Modèle économique cible** | Freemium (Studio AI + Marketplace commission + Wallet plus tard)                           |

---

## 2. Stack technique (figée, voir CLAUDE.md du repo)

- **Mobile** : Expo SDK 55, React Native 0.83, **Dev Build obligatoire**
- **UI** : Tamagui v1.135.5, TypeScript strict, dark theme exclusif
- **Backend** : Supabase (Postgres + Auth + RLS deny-by-default + Storage + Realtime + Edge Functions Deno + pg_cron + pg_net)
- **State** : TanStack Query + Zustand
- **AI** : OpenAI GPT-4o / o3-mini + DALL-E 3 + Whisper, Mistral fallback, Tavily search
- **Appels** : Daily.co `@daily-co/react-native-daily-js`
- **Monitoring** : Sentry (crashes) + PostHog (events + cost monitoring)
- **CI/CD** : GitHub Actions, EAS Build, pnpm

3 environnements Supabase : **dev** (`kbysmkhalnolbsojzahf`), **staging** (`sdapojfdwduhuyduymxk`), **prod** (pas encore créé).

---

## 3. Architecture côté repo

```
doumassi-mobile/
├── app/                  # Routes Expo Router (file-based)
│   ├── (auth)/           # signup, login, complete profile
│   ├── (onboarding)/
│   ├── (tabs)/           # 5 onglets : feed, notifs, studio-ai, messages, profile
│   ├── (feed)/post/[id]  # détail post plein écran
│   ├── messages/         # conversations
│   ├── story/            # viewer + create
│   └── call/             # in-call + incoming
├── src/
│   ├── components/       # feed, share, MentionsText…
│   ├── features/         # auth, calls, comments, feed, mentions, messaging, notifications, profile…
│   ├── hooks/
│   ├── lib/              # supabase client, storage, logger, env
│   └── stores/
├── supabase/
│   ├── migrations/       # 40+ migrations, schéma stable
│   ├── functions/        # Edge Functions : push notifs, export-data, purge-pending-deletions, create-daily-call
│   ├── audits/           # rls_audit_prebeta.sql, rls_audit_calls.sql
│   └── seed.sql
└── docs/                 # ADRs, beta-guide, bug-bash, accessibility, stores
```

21 tables au schéma : `profiles, posts, comments, likes, comment_likes, bookmarks, follows, blocks, stories, story_views, conversations, conversation_participants, messages, calls, listings, listing_bookmarks, notifications, deletion_requests, ai_conversations, push_tokens, audit_logs`.

8 buckets Storage : `avatars, covers, posts, stories, messaging_media, ai_attachments` + 2 internes.

---

## 4. État des features

### ✅ Livré (production-ready en DEV/STAGING)

| Feature             | Détails                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth**            | Signup email + password, login, OAuth Google + Apple, complete profile (avatar, bio, username, naissance), edit profile, reset password                                                                                                                                                                                                                            |
| **Onboarding**      | Choix username unique avec validation, cover photo optionnelle, redirection feed                                                                                                                                                                                                                                                                                   |
| **Profile**         | Mien + profil d'un autre, follow/unfollow, follow requests (compte privé), block, RGPD (export JSON + suppression compte 30j avec modale d'annulation au login), kebab menu (share, block, report)                                                                                                                                                                 |
| **Feed**            | Posts texte ≤ 500 char + 1-4 images, likes (haptic), comments (avec replies 1 niveau), bookmarks, shares (via URL), pagination infinite, pull to refresh                                                                                                                                                                                                           |
| **Stories**         | Photo / vidéo ≤ 15s, 24h auto-expire, tap zones (prev/pause/next), "Vu par" pour l'auteur, navigation entre users automatique                                                                                                                                                                                                                                      |
| **Messagerie**      | DM 1-to-1 + groupes (création multi-select + nom), texte, image (upload+compression), voice (record+player), réponses (encart cliquable + scroll vers parent), mentions `@username` avec dropdown + parsing, sender avatar+username dans bulles de groupe, Realtime live, marquage lu (badge non-lu), edit/delete sur mes bulles, share interne post/profil via DM |
| **Notifications**   | Push (Expo Push Server) + in-app, types : follow, follow_request, like, comment, mention, message, call, system, payment. Routing au tap → bonne destination                                                                                                                                                                                                       |
| **Appels A/V**      | Daily.co, DM only, audio + vidéo, contrôles (mute, camera, switch front/back, hangup), incoming ringtone Accept/Decline (Realtime listener, foreground only), permissions micro/caméra UX, historique appels dans la conv (entry "📞 Appel manqué")                                                                                                                |
| **Universal Links** | `https://doumassi.app/{post,profile,story,u}/{id}` → ouvre l'app native si installée                                                                                                                                                                                                                                                                               |
| **A11y**            | WCAG AA contrastes, accessibilityHint sur actions importantes (Like, Bookmark, Story zones), VoiceOver basique                                                                                                                                                                                                                                                     |

### ⏳ Pas commencé / discussion en cours

| Feature                                  | Statut                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketplace**                          | 8 tickets prêts (E7-01 → E7-08), schéma DB ébauche, maquette Canva existe mais ambitieuse (multi-univers). Discussion CTO sur scope MVP vs vision en cours.           |
| **Studio AI (Doumassi AI)**              | Onglet placeholder dans la tab bar. Schéma `ai_conversations` existe. Tickets E5 dans le backlog. Pas commencé.                                                       |
| **Wallet P2P**                           | Onglet placeholder. **Déconseillé Phase 1** pour cause de compliance (KYC, AML, agrément ACPR, PCI DSS).                                                              |
| **Ship bêta TestFlight + Play Internal** | Bloqué sur : Apple Developer Program à activer (99$/an), Supabase prod à créer, URLs juridiques à publier, builds prod EAS. Estimé ~1 semaine de boulot opérationnel. |

---

## 5. Métriques quantitatives (au 29/06/2026)

- **PRs mergées dans `dev`** : ~50+ depuis le démarrage (>20 sur le dernier mois)
- **Tickets fermés** : ~100+ sur 114 initiaux + tickets post-bêta ajoutés
- **Tickets ouverts** : ~10 (Studio AI + Marketplace + follow-up calls + audit RLS à exécuter)
- **Migrations SQL appliquées** : 40+ (DEV synchro, STAGING en majorité, PROD ❌ à créer)
- **Linter / typecheck** : 100 % vert sur dev
- **Tests** : couverture partielle, pas systématique (à challenger)
- **Sprints terminés** : Sprint 0 → Sprint 6 + 80 % de Sprint 7

---

## 6. Bugs connus / dette technique

| Niveau    | Élément                                                                       | Notes                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🔴 P1** | Bug 403 sur le bouton appel                                                   | Le 2e essai d'appel renvoie "Not a participant of this conversation" alors que le 1er a marché. Pas debug à fond — peut être : conv différente, JWT expiré, ou bug état côté client. À investiguer. |
| **🟠 P2** | Sender info groupes incomplet                                                 | Côté DM le `display_name` arrive. Côté groupes, on a un fallback "@un membre" qui marche mais demande un fetch profile additionnel. Acceptable MVP.                                                 |
| **🟠 P2** | Tests devices Calls                                                           | Aucun test E2E sur 2 devices physiques (l'user n'a qu'un téléphone). Risque de bug en prod.                                                                                                         |
| **🟡 P3** | Audit RLS calls                                                               | Script SQL écrit (`supabase/audits/rls_audit_calls.sql`) mais pas encore exécuté sur DEV/STAGING.                                                                                                   |
| **🟡 P3** | Foreground-only pour incoming calls                                           | Si l'app est killed, on rate l'appel entrant. CallKit iOS / ConnectionService Android = V2.                                                                                                         |
| **🟡 P3** | Pas de viewer plein écran image dans messages                                 | Tap sur image affiche la même image. Vraie modale lightbox = post-bêta.                                                                                                                             |
| **🟡 P3** | Pas de waveform réelle vocaux                                                 | 10 barres décoratives, pas l'amplitude. Cosmétique.                                                                                                                                                 |
| **🟡 P3** | A11y manuel pas joué (VoiceOver, Dynamic Type, Accessibility Scanner Android) | Doc `post-beta-results.md` créé en attente. À jouer pendant le bug bash.                                                                                                                            |

---

## 7. Décisions techniques (ADRs documentés)

| ADR     | Décision                             |
| ------- | ------------------------------------ |
| **001** | Tamagui v1 (vs alternatives RN UI)   |
| **002** | Palette dark + neon green `#10D970`  |
| **003** | Expo SDK 55 + Dev Build (vs Expo Go) |
| **004** | Tamagui v1 stable (vs v2 RC pas GA)  |

ADRs absentes mais à formaliser : Daily.co (vs Twilio / Agora / LiveKit), useApprovalSheet pour les groupes, etc.

---

## 8. Roadmap Phase 1 vs ce qui est livré

| Sprint | Plan initial               | Réalité                                                                                               | Écart                                                    |
| ------ | -------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0**  | Setup infrastructure       | ✅ Done                                                                                               | OK                                                       |
| **1**  | Auth & Onboarding          | ✅ Done                                                                                               | OK                                                       |
| **2**  | Profil + Social Graph      | ✅ Done                                                                                               | OK                                                       |
| **3**  | Feed & Notifs              | ✅ Done                                                                                               | OK                                                       |
| **4**  | Stories                    | ✅ Done                                                                                               | OK                                                       |
| **5**  | Messagerie basique         | ✅ Done                                                                                               | OK                                                       |
| **6**  | Studio AI T1 + Marketplace | ❌ Pas fait. Re-priorisé sur **messagerie avancée** (image, voice, groupes, réponses, mentions, a11y) | Décalage : Marketplace et Studio AI repoussés après bêta |
| **7**  | Stabilisation + bêta       | 🟡 Partiel : appels A/V livrés, bug bash trame écrite, bêta TestFlight pas faite                      |

**Conclusion** : on a une app **plus mature côté social/messagerie** que prévu, mais **en retard sur Studio AI / Marketplace** et **pas encore en main d'utilisateurs réels**.

---

## 9. Questions stratégiques ouvertes pour la direction

### 9.1 Priorité de la prochaine grande étape

Options (avec mon avis CTO) :

| Option                                                | Pro                                                                                                                                                               | Contre                                                                                             | Mon vote                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **A. Ship bêta TestFlight + Play Internal**           | Tu fais sortir 5 mois de boulot dans les mains de vrais utilisateurs. Apprentissage massif.                                                                       | Beaucoup d'opérationnel (Apple Developer, Supabase prod, builds, soumission). ~1 semaine non-code. | 🟡 **Devrait être fait depuis 2 semaines** |
| **B. Doumassi AI / Studio AI**                        | Vrai différenciant vs concurrence FR (Vinted/Lydia/WhatsApp). Monétisation freemium évidente.                                                                     | 2-3 semaines dev. Coût API OpenAI à monitorer (estimé ~1€/user/mois actif)                         | 🟢 **Plus impactant produit**              |
| **C. Marketplace vitrine**                            | Cohérent avec cadrage Phase 1 (tickets prêts). Réutilise messagerie existante (DM = contact vendeur). Maquette ambitieuse mais MVP simple faisable en 2 semaines. | Risque "marketplace vide" tant que pas de masse critique d'utilisateurs (network effect).          | 🟡 **Bon en parallèle de A**               |
| **D. Investiguer bug 403 calls + tester avec 2 tels** | Stabilise une feature qu'on vient de livrer.                                                                                                                      | 1-2j de debug. Bloqué tant que pas de 2e device pour Abdou.                                        | 🟢 **Bloquant pour confiance dans calls**  |

### 9.2 Marketplace : MVP simple ou vision multi-univers ?

La maquette Canva montre 7 univers (Business produits, AI immobilier, Jeux, Vidéos, Musique, Cours, Wallet). C'est **bien plus** qu'une "marketplace classique".

Mon avis :

- **Faisable en Phase 1** : Business produits + filtres + bookmarks + contact vendeur via DM (~2 semaines)
- **Hors scope Phase 1** : Jeux (Play Store interne), Vidéos (streaming), Musique (streaming + droits SACEM 50-200k€/an), Cours (LMS = produit à part)

**Question** : qu'est-ce qui est négociable ? La maquette est une vision, mais elle n'est pas tenable en 1 sprint.

### 9.3 Navigation : où placer la marketplace ?

Tab bar actuelle (5 onglets) : `Home (feed) | Notifs | Studio AI (#) | Messages | Profile`.

La maquette marketplace a sa propre nav top `Business / AI / Wallet / Soon`, indépendante. Conflit de territoire à résoudre :

- A) Remplacer Studio AI (#) par "Shop" ?
- B) Garder Studio AI et ajouter un 6e onglet "Shop" ?
- C) La marketplace est dans l'onglet Home (= concurrence avec le feed social) ?
- D) On accepte 2 tab bars (top pour marketplace, bottom pour app) ?

### 9.4 Bêta : combien d'utilisateurs et pour quoi faire ?

Le `beta-guide.md` cible 50 testeurs internes/proches. Mais on n'a pas encore défini :

- **Métriques de succès bêta** : 70 % d'utilisateurs reviennent à J+7 ? Combien de posts créés ? DAU/MAU ?
- **Durée bêta** : 2 semaines fermée puis ouverte ? 1 mois ?
- **Critères pour passer en V1 publique** : 0 bug P0 ? Note app store > 4.5 ? 100 testeurs actifs ?

### 9.5 Studio AI : intégrer dans la messagerie ou écran séparé ?

L'icône `#` actuelle dans la tab bar pointe vers `Studio AI` mais c'est un placeholder. Question :

- A) C'est un chat avec une IA distincte (style ChatGPT app intégré)
- B) C'est un _user_ spécial @doumassi_ai qui apparaît dans les conversations normales (et tout le code messagerie est réutilisé)
- C) C'est une combinaison : un onglet dédié pour l'usage AI + une command `@doumassi_ai` dans les conversations classiques

Mon vote : **C** — meilleur ratio impact / effort, et ça crée un coup d'inertie d'usage (les gens utilisent l'IA depuis n'importe où dans l'app).

### 9.6 Wallet : aller à fond ou laisser tomber ?

Wallet P2P (paiement entre utilisateurs) = compliance énorme :

- Agrément ACPR ou PSP partenaire (Stripe Connect, Treezor, Swan, Lemonway, etc.)
- KYC complet
- PCI DSS audit (5-15k€)
- Avocat (10k€)
- Délai ~6 mois min

**Mon vote** : abandonner Wallet pour Phase 1, garder le placeholder "Bientôt", lever des fonds AVANT de l'attaquer.

### 9.7 Monétisation

Quand activer le premier revenu ? Options :

- **Abo Studio AI freemium** (5 messages gratuits/jour, puis 4.99€/mois illimité)
- **Commission marketplace** (3 % sur les transactions, mais demande PSP intégré)
- **Boost de posts** (sponsorisé dans le feed, type LinkedIn)
- **Ads natives** (déconseillé — abîme l'image FR/anti-pub)

Mon vote : **Abo Studio AI** dès qu'il existe. C'est le plus simple à mettre en place et le plus aligné avec la promesse premium FR.

---

## 10. Risques business identifiés

| Risque                                                             | Probabilité | Impact       | Mitigation actuelle                                                                |
| ------------------------------------------------------------------ | ----------- | ------------ | ---------------------------------------------------------------------------------- |
| **Réseau social vide** : nouveau user arrive, voit 5 posts, repart | 🔴 Élevée   | 🔴 Critique  | Aucune. À adresser via seed content + invitations ciblées                          |
| **Compétition WhatsApp/Insta/Telegram**                            | 🟠 Moyenne  | 🔴 Critique  | Différenciation = super-app FR + AI intégré + bonne UX                             |
| **Coûts API OpenAI hors contrôle**                                 | 🟡 Faible   | 🟠 Important | Hard caps + PostHog cost monitoring déjà câblé                                     |
| **Daily.co rate limits / coûts**                                   | 🟡 Faible   | 🟠 Important | Free tier 10k min/mois OK pour bêta. Spend limit hardcodé à activer dans dashboard |
| **Apple/Google rejet de l'app store**                              | 🟡 Faible   | 🟠 Important | Compliance basique en place (privacy, terms, data deletion). À vérifier metadata.  |
| **Bug en prod en bêta**                                            | 🟠 Moyenne  | 🟡 Modéré    | Sentry câblé, hotfix process en place via PRs. Bug bash prévu.                     |
| **Burnout équipe**                                                 | 🟡 Faible   | 🟠 Important | 4 ETP pour Phase 1, charte d'équipe sur Notion                                     |

---

## 11. Demande pour le LLM externe (Claude.ai web)

> En tant que conseiller stratégique, **étant donné l'état actuel de l'app décrit ci-dessus**, aide-moi à trancher :
>
> 1. Quelle est **la prochaine grande étape** entre A (ship bêta), B (Studio AI), C (Marketplace) et D (debug calls) ?
> 2. Faut-il **réduire le scope** de la maquette marketplace (multi-univers) à une marketplace produits classique pour la bêta ?
> 3. **Quand activer le 1er revenu** et sur quelle feature ?
> 4. **Comment gérer le retard** sur Studio AI / Marketplace vs cadrage initial sans frustrer l'équipe ?
> 5. Quels **KPI de succès bêta** mettre en place ?
>
> J'ai 4 ETP et probablement encore 4-6 semaines avant de risquer un burnout. La caisse n'est pas infinie mais on a encore quelques mois d'autonomie. L'objectif business est d'arriver à un état où on peut **lever (Seed) ou se rentabiliser sur abo Studio AI** avant Q4 2026.

---

_Document généré à la fin de la session du 29 juin 2026 par Abdou + Claude Code en pair-programming._
