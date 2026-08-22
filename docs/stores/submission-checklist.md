# Checklist de soumission DOUMASSI v0.1.0-beta

Procédure pas-à-pas pour build prod + soumission TestFlight + Play Internal.

## Pré-requis avant de lancer le build prod

### Compte Apple Developer

- [ ] Compte Apple Developer Program actif (99 $/an)
- [ ] App créée dans App Store Connect avec bundle ID `com.doumassi.app`
- [ ] Capacities activées : Push Notifications, Sign in with Apple (si OAuth Apple), Associated Domains (`applinks:doumassi.app`)
- [ ] Certificats de signature et profil de provisioning gérés automatiquement par EAS (rien à faire manuellement)

### Compte Google Play

- [ ] Compte Google Play Developer actif (25 $ une fois)
- [ ] App créée dans Play Console avec package name `com.doumassi.app`
- [ ] Play App Signing activé (Google gère la clé de signature finale)
- [ ] Service account JSON pour EAS Submit créé et téléchargé (Settings → API access → Create Service Account → Editor role)
- [ ] Permissions de release configurées pour le service account

### Configuration EAS

- [ ] `eas.json` profile production OK (déjà fait — voir [eas.json](../../eas.json))
- [ ] Secrets EAS configurés via `eas secret:create` :
  - `APPLE_ID` : email de ton compte Apple
  - `ASC_APP_ID` : App Store Connect app ID
  - `APPLE_TEAM_ID` : Team ID Apple Developer
  - `GOOGLE_SERVICE_ACCOUNT_KEY` : contenu JSON de la clé Google
- [ ] Compte Expo connecté : `pnpm dlx eas whoami` retourne ton account

### Pré-requis app

- [ ] Toutes les Edge Functions déployées sur projet **production** Supabase (à créer)
- [ ] Variables d'environnement de production configurées (URL Supabase prod, anon key prod)
- [ ] Sentry et PostHog configurés pour l'environnement prod
- [ ] Smoke test du build staging passé sans crash bloquant
- [ ] Audit RLS pré-bêta passé sur staging (12/12 tests OK — voir [rls_audit_prebeta.sql](../../supabase/audits/rls_audit_prebeta.sql))

### Pré-requis stores

- [ ] Politique de confidentialité publiée à https://doumassi.app/privacy
- [ ] CGU publiées à https://doumassi.app/terms
- [ ] Site web minimal à https://doumassi.app avec liens vers ces 2 pages
- [ ] Adresse email `support@doumassi.com` opérationnelle (MX configuré)
- [ ] Adresse email `beta@doumassi.com` opérationnelle
- [ ] Adresse email `privacy@doumassi.com` opérationnelle

### Pré-requis assets stores

- [ ] Icône d'app 1024×1024 PNG (déjà présente dans `assets/`)
- [ ] Splash screen 2048×2732 PNG (déjà présent)
- [ ] 5 captures d'écran iPhone 6.7" (1290×2796) — **à produire après build prod**
- [ ] 5 captures Android téléphone (au moins 1080×1920 ou plus) — **à produire après build prod**
- [ ] Image promo Play Store 1024×500 PNG — **à créer (logo + tagline)**
- [ ] Icône Play Store 512×512 PNG — **export depuis icône d'app**

## Étape 1 — Build prod iOS

```bash
# Vérifie la version dans app.json (1.0.0)
pnpm dlx eas build --platform ios --profile production

# Le build prend 15-30 min. Tu peux suivre via :
# https://expo.dev/accounts/abdou_01/projects/DOUMASSI-Application/builds
```

Vérifications post-build :

- [ ] Build status : `Finished`
- [ ] Pas d'erreurs de signing
- [ ] `.ipa` téléchargeable depuis le dashboard EAS

## Étape 2 — Build prod Android

```bash
pnpm dlx eas build --platform android --profile production

# Output : .aab (App Bundle) signé par EAS
```

Vérifications post-build :

- [ ] Build status : `Finished`
- [ ] `.aab` téléchargeable

## Étape 3 — Soumission TestFlight (iOS)

### Option A — Via EAS Submit (recommandé)

```bash
pnpm dlx eas submit --platform ios --profile production --latest

# EAS upload le build directement dans App Store Connect → TestFlight
# Le binaire passe en "processing" 30-60 min côté Apple
```

### Option B — Via Transporter (fallback si EAS Submit pose problème)

1. Télécharger Transporter depuis Mac App Store
2. Glisser-déposer le `.ipa` téléchargé depuis EAS
3. Cliquer « Livrer »

### Une fois le build "Ready to test" dans App Store Connect

- [ ] Renseigner les **Beta Test Information** (voir [metadata-app-store.md](metadata-app-store.md))
- [ ] Créer le groupe **« Équipe DOUMASSI »** (interne, jusqu'à 100 testeurs)
- [ ] Ajouter les testeurs par email (Biram, Abdou, Farah, Ilias, +6 invités externes)
- [ ] Activer **« Sign in with Apple »** dans les capacités si OAuth Apple utilisé
- [ ] Soumettre pour **TestFlight Review** (1-24h en général)
- [ ] Une fois approuvé : envoyer les invitations TestFlight

## Étape 4 — Soumission Play Internal (Android)

### Via EAS Submit

```bash
pnpm dlx eas submit --platform android --profile production --latest --track internal

# EAS upload le .aab dans le canal Internal Testing
```

### Configuration Play Console

- [ ] Créer la fiche d'app si pas encore fait (voir [metadata-play-store.md](metadata-play-store.md))
- [ ] Remplir le questionnaire IARC (classification d'âge)
- [ ] Remplir la déclaration **Données collectées et partagées**
- [ ] Renseigner la **Politique de confidentialité** : https://doumassi.app/privacy
- [ ] Créer la liste de testeurs internes (Google Groups `beta-doumassi@googlegroups.com`)
- [ ] Activer le canal **Internal Testing**
- [ ] Promouvoir le build du Closed Testing vers Internal Testing
- [ ] Récupérer le **lien d'opt-in** pour les testeurs et le partager

## Étape 5 — Invitation des testeurs

- [ ] Préparer un email d'invitation (template ci-dessous)
- [ ] Envoyer aux 10 premiers testeurs
- [ ] Publier le lien d'opt-in dans Slack #general
- [ ] Surveiller #beta-feedback pour les premiers retours

### Template email

```
Objet : Vous êtes invité à tester DOUMASSI 🎉

Bonjour [Prénom],

Vous êtes invité à participer à la bêta fermée de DOUMASSI, la super-application française.

📱 INSTALLATION

iOS (TestFlight) : [lien TestFlight]
Android : [lien Play Internal]

📖 GUIDE DU BÊTA-TESTEUR

Avant de commencer, merci de lire le guide bêta :
https://github.com/Waoow-tech/DOUMASSI-Application/blob/dev/docs/beta-guide.md

🐛 REMONTÉE DE BUGS

- Slack : #beta-feedback sur https://doumassiworkspace.slack.com
- Email : beta@doumassi.com

Bon test et merci pour votre temps !

L'équipe DOUMASSI
```

## Étape 6 — Suivi post-soumission

- [ ] Surveiller le **Sentry dashboard** pour les premiers crashes
- [ ] Surveiller **PostHog** pour les events utilisateurs
- [ ] Lire **#beta-feedback** plusieurs fois par jour les 3 premiers jours
- [ ] Préparer un **hotfix process** (branche `hotfix/X` + cycle build prod accéléré) au cas où

## Annexe — Time-box estimé

| Étape                            | Durée estimée                      |
| -------------------------------- | ---------------------------------- |
| Configuration EAS secrets        | 30 min                             |
| Build iOS                        | 20-30 min (EAS Free Tier en queue) |
| Build Android                    | 15-25 min                          |
| Submit TestFlight + review Apple | 1-24h                              |
| Submit Play Internal             | 5-15 min (pas de review)           |
| Tests fumée sur TestFlight       | 1h                                 |
| Envoi invitations                | 30 min                             |
| **Total réaliste**               | **1 jour à 1,5 jour**              |

⚠️ **Marge Apple Review** : prévoir 24h de buffer pour le TestFlight Review (généralement <12h mais parfois 24-48h).

## Liens & docs externes

- [EAS Build documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Google Play Console](https://play.google.com/console)
- [Expo Account](https://expo.dev/accounts/abdou_01)
