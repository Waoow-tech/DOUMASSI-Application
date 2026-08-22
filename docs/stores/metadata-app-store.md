# App Store Connect — Metadata DOUMASSI v0.1.0-beta

À copier-coller dans App Store Connect lors de la soumission TestFlight + App Store.

## Informations générales

| Champ                                  | Valeur                                    |
| -------------------------------------- | ----------------------------------------- |
| **Nom de l'app**                       | DOUMASSI                                  |
| **Sous-titre**                         | The French super-app                      |
| **Bundle ID**                          | `com.doumassi.app`                        |
| **Catégorie principale**               | Réseaux sociaux                           |
| **Catégorie secondaire**               | Style de vie                              |
| **Classification d'âge**               | 13+ (contenu utilisateur non modéré 100%) |
| **Site web**                           | https://doumassi.app                      |
| **Email support**                      | support@doumassi.com                      |
| **Email marketing**                    | contact@doumassi.com                      |
| **Politique de confidentialité (URL)** | https://doumassi.app/privacy              |
| **CGU (URL)**                          | https://doumassi.app/terms                |
| **Copyright**                          | © 2026 COSMOS                             |

## Description courte (Promotional Text — 170 caractères max)

```
DOUMASSI réunit réseau social, marketplace, IA et portefeuille numérique dans une seule app pensée pour la France. Connectez, partagez, achetez et créez.
```

_(155 caractères)_

## Description longue (Description — 4000 caractères max)

```
DOUMASSI est la super-application française qui réunit dans une seule app tout ce que vous faites au quotidien sur votre téléphone.

🌐 RÉSEAU SOCIAL COMPLET
Publiez des posts texte ou images, partagez des stories éphémères (24 h), suivez vos amis et créateurs préférés, commentez et likez ce qui vous touche, sauvegardez vos posts favoris pour les retrouver plus tard.

💬 MESSAGERIE PRIVÉE
Discutez en privé avec n'importe quel autre utilisateur. Vos messages arrivent en temps réel, vous pouvez les éditer ou les supprimer. Tout est chiffré en transit.

📸 STORIES ÉPHÉMÈRES
Capturez photo ou vidéo en un tap, partagez avec vos abonnés pendant 24 h, et voyez qui a regardé chacune de vos stories.

🔔 NOTIFICATIONS INTELLIGENTES
Soyez prévenu en temps réel quand quelqu'un vous suit, réagit à un post, vous écrit, ou interagit avec votre contenu.

🇫🇷 PENSÉE POUR LA FRANCE
Interface en français par défaut, contenu juridique conforme au cadre français et européen, hébergement dans le respect du RGPD. Vos données restent en Europe.

🔒 VIE PRIVÉE RESPECTÉE
- Exportez toutes vos données en un clic (JSON)
- Supprimez votre compte à tout moment avec un délai de récupération de 30 jours
- Vos données ne sont jamais vendues, jamais partagées à des fins publicitaires
- Conformité RGPD complète

📲 PROCHAINEMENT
Marketplace pour vendre et acheter localement, assistant IA conversationnel, portefeuille numérique pour vos paiements, et bien plus encore.

DOUMASSI est en bêta fermée. Rejoignez les premiers utilisateurs et participez à construire la super-app française.
```

_(1490 caractères)_

## Mots-clés (Keywords — 100 caractères max, séparés par virgules sans espaces)

```
social,messagerie,stories,communauté,réseau,partage,français,amis,chat,photos,vidéos,france
```

_(112 caractères → à raccourcir)_

**Version définitive (100 caractères) :**

```
social,messagerie,stories,communauté,réseau,partage,français,amis,chat,france,photos
```

_(96 caractères)_

## What's New (Release notes — 4000 caractères max)

```
Première version de DOUMASSI 🎉

Cette bêta inclut :
• Création de compte par email, numéro ou Google
• Profils personnels et publics avec photo de couverture
• Fil d'actualité avec posts texte et images
• Stories éphémères photo et vidéo (24 h)
• Messagerie privée 1-to-1 en temps réel
• Notifications push pour ne rien manquer
• Export et suppression de vos données (RGPD)

Merci de tester l'app et de nous remonter vos retours via Slack #beta-feedback ou par email à beta@doumassi.com.

L'équipe DOUMASSI
```

## Screenshots requis (à produire)

### iPhone 6.7" (1290×2796 pixels) — obligatoire

3 à 10 captures, au moins 1 obligatoire :

1. Écran d'accueil / login
2. Fil d'actualité avec posts
3. Création d'une story
4. Conversation messagerie
5. Profil utilisateur

### iPhone 6.5" (1284×2778 pixels) — obligatoire

Mêmes captures que 6.7" en redimensionné.

### iPad Pro 12.9" (2048×2732 pixels) — optionnel pour cette bêta

Si livré, mêmes captures que iPhone.

**Outil recommandé** : utiliser le Dev Build sur un iPhone 15 Pro Max (6.7") + capture native, puis redimensionner avec [Apple Screenshot Generator](https://help.apple.com/app-store-connect/#/devd1093a07f) ou exporter via Xcode Simulator.

## App Preview (optionnel)

Vidéo de 15 à 30 secondes montrant les fonctions clés. Recommandé pour la bêta publique, **pas obligatoire pour TestFlight bêta fermée**.

## Beta test (TestFlight)

| Champ                       | Valeur                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description du test**     | « Bêta fermée DOUMASSI — vous êtes invité à tester en avant-première la super-app française. Merci de nous remonter vos retours via Slack. » |
| **Email à contacter**       | beta@doumassi.com                                                                                                                            |
| **URL de feedback**         | https://doumassi.app/feedback (ou Slack)                                                                                                     |
| **Notes pour les testeurs** | Lire le guide bêta : [docs/beta-guide.md](../beta-guide.md)                                                                                  |
| **Groupe externe (public)** | ❌ NON — bêta fermée, accès sur invitation uniquement                                                                                        |
| **Groupe interne**          | ✅ « Équipe DOUMASSI » (CTO + stagiaires + Biram)                                                                                            |
| **Volume max**              | 100 testeurs (Apple permet jusqu'à 10 000)                                                                                                   |

## Compliance & déclarations Apple

| Question                           | Réponse                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| **Chiffrement**                    | NON — pas de chiffrement non-standard, uniquement HTTPS et chiffrement par défaut iOS |
| **Contenu généré par utilisateur** | OUI — système de signalement à implémenter Sprint 7 (post-bêta)                       |
| **Idea data tracking**             | OUI — PostHog pour analytics anonymisés (pas d'IDFA, pas de cross-app tracking)       |
| **Compte requis**                  | OUI — création de compte obligatoire                                                  |
| **Compte effaçable depuis l'app**  | OUI — Settings → Compte → Supprimer mon compte                                        |
| **Données collectées**             | Email, téléphone (OAuth), nom d'utilisateur, contenu publié, photos uploadées         |
| **Données liées à l'utilisateur**  | OUI                                                                                   |
| **Données pour suivi**             | NON                                                                                   |

## Liens utiles

- [App Store Connect](https://appstoreconnect.apple.com/)
- [Apple Developer Documentation — App Submission](https://developer.apple.com/app-store/review/)
- [TestFlight Configuration](https://developer.apple.com/testflight/)
