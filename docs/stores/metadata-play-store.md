# Play Store — Metadata DOUMASSI v0.1.0-beta

À copier-coller dans Google Play Console lors de la soumission Internal Testing.

## Informations générales

| Champ                                  | Valeur                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| **Nom de l'application**               | DOUMASSI                                                               |
| **Description courte (80 char)**       | Réseau social français : posts, stories, messagerie privée temps réel. |
| **Package name**                       | `com.doumassi.app`                                                     |
| **Catégorie**                          | Réseaux sociaux                                                        |
| **Tags**                               | Social, Communication, Photo, Vidéo                                    |
| **Classification du contenu**          | PEGI 12 (à confirmer via questionnaire IARC)                           |
| **Public cible**                       | 13+                                                                    |
| **Site web**                           | https://doumassi.app                                                   |
| **Email contact**                      | support@doumassi.com                                                   |
| **Téléphone**                          | (laisser vide pour bêta)                                               |
| **Politique de confidentialité (URL)** | https://doumassi.app/privacy                                           |
| **Pays de production**                 | France                                                                 |

## Description complète (4000 caractères max)

```
DOUMASSI est la super-application française qui réunit dans une seule app tout ce que vous faites au quotidien sur votre téléphone.

🌐 RÉSEAU SOCIAL COMPLET
Publiez des posts texte ou images, partagez des stories éphémères qui s'effacent au bout de 24 h, suivez vos amis et créateurs préférés, commentez et likez ce qui vous touche, sauvegardez vos posts favoris pour les retrouver plus tard.

💬 MESSAGERIE PRIVÉE
Discutez en privé avec n'importe quel autre utilisateur. Vos messages arrivent en temps réel, vous pouvez les éditer ou les supprimer. Tout est chiffré en transit.

📸 STORIES ÉPHÉMÈRES
Capturez photo ou vidéo en un tap, partagez avec vos abonnés pendant 24 h, et voyez qui a regardé chacune de vos stories grâce à la liste « Vu par ».

🔔 NOTIFICATIONS INTELLIGENTES
Soyez prévenu en temps réel quand quelqu'un vous suit, réagit à un post, vous écrit un message, ou interagit avec votre contenu. Vous pouvez désactiver les notifications conv par conv.

🇫🇷 PENSÉE POUR LA FRANCE
Interface en français par défaut, contenu juridique conforme au cadre français et européen, hébergement dans le respect du RGPD. Vos données restent en Europe.

🔒 VIE PRIVÉE RESPECTÉE
• Exportez toutes vos données en un clic au format JSON (RGPD article 20 - portabilité)
• Supprimez votre compte à tout moment avec un délai de récupération de 30 jours
• Vos données ne sont jamais vendues, jamais partagées à des fins publicitaires
• Aucun tracking entre applications, aucune publicité ciblée
• Conformité RGPD complète

📲 PROCHAINEMENT
• Marketplace pour vendre et acheter localement entre particuliers et auto-entrepreneurs
• Assistant IA conversationnel intégré
• Portefeuille numérique pour vos paiements peer-to-peer
• Appels audio et vidéo

DOUMASSI est en bêta fermée. Rejoignez les premiers utilisateurs et participez à construire la super-app française.
```

_(2000 caractères environ)_

## Captures d'écran requises

### Téléphone — minimum 2, maximum 8

Format : PNG ou JPEG, résolution minimum 320 px, maximum 3840 px, ratio entre 1:2 et 2:1.

Captures à produire :

1. Écran d'accueil / login
2. Fil d'actualité avec posts
3. Création d'une story
4. Conversation messagerie
5. Profil utilisateur

### Tablette 7" / 10" — optionnel pour bêta

À ajouter si on déploie public ultérieurement.

### Image promo (1024×500) — obligatoire

Bannière de présentation. À produire avec le logo DOUMASSI + tagline « The French super-app ».

### Icône Play Store (512×512) — obligatoire

Reprendre l'icône d'app actuelle, exportée en 512×512 PNG.

## Internal Testing

| Champ              | Valeur                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Nom du test**    | « DOUMASSI Beta Interne »                                                                            |
| **Description**    | Bêta fermée DOUMASSI — accès sur invitation. Merci de remonter vos retours via Slack #beta-feedback. |
| **Email feedback** | beta@doumassi.com                                                                                    |
| **Testeurs**       | Liste Google Groups privée à créer (`beta-doumassi@googlegroups.com`)                                |
| **Volume max**     | 100 testeurs (Google permet jusqu'à 100 sur Internal Testing)                                        |
| **Distribution**   | App bundle (.aab) signé par Play App Signing                                                         |

## Déclarations contenu Play Console

| Question                                 | Réponse                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **L'app contient-elle des publicités ?** | NON                                                                                                                           |
| **Achats intégrés ?**                    | NON (Sprint 6 — wallet)                                                                                                       |
| **Contenu sensible**                     | OUI — contenu généré par utilisateurs, signalement à implémenter Sprint 7                                                     |
| **Données collectées**                   | Email, téléphone, contenu publié, photos uploadées, données techniques (crashes via Sentry, analytics anonymisés via PostHog) |
| **Données partagées avec des tiers**     | Supabase (hébergement), Sentry (monitoring crashes), PostHog (analytics anonymisés)                                           |
| **Données chiffrées en transit**         | OUI — HTTPS partout                                                                                                           |
| **Suppression compte depuis l'app**      | OUI — Settings → Compte → Supprimer mon compte                                                                                |

## Compliance Play Store

### Public cible et classification IARC

Lancer le questionnaire IARC dans Play Console :

- Contenu généré par l'utilisateur : OUI
- Violence : NON
- Nudité explicite : NON
- Drogue / alcool / tabac : NON (modération à implémenter)
- Jeux d'argent : NON
- Localisation partagée : NON (Sprint 6)
- Achats intégrés : NON

→ Devrait donner classification **PEGI 12** ou équivalent.

### Permissions Android demandées

| Permission              | Justification                                      |
| ----------------------- | -------------------------------------------------- |
| `INTERNET`              | Communication serveur                              |
| `CAMERA`                | Création de stories + sélection de photo de profil |
| `READ_EXTERNAL_STORAGE` | Sélection d'images depuis la galerie               |
| `RECORD_AUDIO`          | Enregistrement vidéo des stories (audio inclus)    |
| `POST_NOTIFICATIONS`    | Notifications push                                 |
| `WAKE_LOCK`             | Notifications push en arrière-plan                 |

Pas de permissions sensibles : pas de SMS, pas de contacts, pas de GPS, pas de calendrier.

## Liens utiles

- [Google Play Console](https://play.google.com/console)
- [Play Console - App Bundle](https://developer.android.com/guide/app-bundle)
- [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [IARC Rating System](https://support.google.com/googleplay/android-developer/answer/188189)
