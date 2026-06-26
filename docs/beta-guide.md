# Guide du bêta-testeur DOUMASSI

Bienvenue parmi les premiers utilisateurs de DOUMASSI 🎉

Ce guide vous explique comment installer la bêta, ce que vous pouvez tester, et comment nous remonter vos retours.

## 1. Installation

### iOS (TestFlight)

1. Vous avez reçu un email d'invitation de **TestFlight** (Apple). Acceptez l'invitation.
2. Installez TestFlight depuis l'App Store si vous ne l'avez pas déjà.
3. Ouvrez TestFlight → onglet « Apps » → tapez sur **DOUMASSI** → « Installer ».
4. L'app apparaît sur votre écran d'accueil iOS comme n'importe quelle autre.

### Android (Play Internal)

1. Vous avez reçu un email d'invitation au **circuit interne** Play Store.
2. Cliquez sur le lien dans l'email pour accepter (vous devez être connecté à votre compte Google sur l'appareil).
3. Ouvrez Play Store → recherchez **DOUMASSI** → installez.
4. Vérifiez bien que la version est marquée « Bêta interne » dans la fiche du store.

## 2. Premier lancement

1. Au démarrage, vous arrivez sur l'écran d'accueil avec le logo DOUMASSI.
2. Tapez sur **Créer un compte** (ou **Se connecter** si vous en avez déjà un).
3. Suivez le parcours d'inscription : email + mot de passe, puis acceptez les CGU et la politique de confidentialité.
4. Étape 1 d'onboarding : ajoutez une photo de profil, votre prénom + nom, une bio courte.
5. Étape 2 : choisissez votre nom d'utilisateur (`@username`) et votre date de naissance.
6. Vous arrivez sur le fil d'actualité 🎉

## 3. Ce qu'on vous demande de tester en priorité

### Parcours « réseau social » classique

- [ ] Créer un post avec du texte
- [ ] Créer un post avec 1 à 4 images
- [ ] Aimer / commenter / sauvegarder un post
- [ ] Suivre un autre utilisateur
- [ ] Voir vos abonnés et abonnements
- [ ] Visiter votre profil et celui d'un autre utilisateur

### Parcours stories

- [ ] Créer une story photo (tap)
- [ ] Créer une story vidéo (long-press, max 15 s)
- [ ] Voir les stories des autres (tap droite/gauche pour naviguer)
- [ ] Sur votre propre story : tapez « Vu par » en bas pour voir qui l'a vue

### Parcours messagerie (nouveau)

- [ ] Ouvrir l'onglet **Messages**
- [ ] Démarrer une nouvelle conversation depuis le profil d'un autre utilisateur (bouton + en haut)
- [ ] Envoyer plusieurs messages texte
- [ ] **Long-press sur l'un de vos messages** : essayez de le modifier puis de le supprimer
- [ ] Recevoir un message en temps réel (demandez à un autre testeur de vous écrire)

### Parcours RGPD (important pour nous)

- [ ] Paramètres → Compte → **Exporter mes données** → un fichier JSON doit se télécharger via le partage natif
- [ ] Paramètres → Compte → **Supprimer mon compte** → confirmez en tapant SUPPRIMER → vous êtes déconnecté
- [ ] Reconnectez-vous avec le même compte → l'écran vous propose d'**annuler la suppression**, faites-le, vérifiez que votre compte est restauré

### Parcours notifications

- [ ] Vérifier qu'une notification push arrive lorsqu'un autre utilisateur vous suit, like, commente, ou vous envoie un message
- [ ] Taper sur la notification → l'app s'ouvre directement sur la bonne destination (profil, post, conversation)

## 4. Ce qu'on **ne vous demande pas** de tester

Les fonctions suivantes apparaissent en placeholder « Bientôt » dans l'app, c'est normal :

- 🛒 Marketplace
- 🤖 Doumassi AI
- 💳 Wallet (portefeuille)
- 📞 Appels audio / vidéo
- 💬 Conversations de groupe
- 📷 Envoi d'images / messages vocaux dans les messages

Ces fonctionnalités arriveront dans les prochaines versions, on travaille dessus.

## 4 bis. Limites connues de cette bêta

Quelques fonctionnalités sont volontairement réduites pour cette première version. On les ajoutera dans les prochaines mises à jour :

- **Partage interne d'un post ou d'un profil vers un ami DOUMASSI** : pour l'instant, le bouton « Partager » sur un post copie un lien `https://doumassi.app/post/...` que vous pouvez envoyer par SMS, WhatsApp, etc. L'envoi direct dans une conversation DOUMASSI arrive Sprint 6.
- **Réponse à un message spécifique** : la réponse à un message précis dans une conversation arrive Sprint 6 (le schéma est déjà en place côté serveur).
- **Mentions `@username` dans les posts et messages** : arrive Sprint 6.
- **Hashtags `#tag`** : arrive Sprint 6.
- **Modale de rappel d'annulation au login** si une suppression de compte est en cours : pour la bêta, vous accédez quand même au feed normalement et vous voyez le statut dans `Paramètres → Compte → Supprimer mon compte`. Une modale d'annulation directement au login viendra plus tard.

## 5. Comment remonter vos retours

### Pour un bug

1. Sur Slack : canal `#beta-feedback` sur `doumassiworkspace.slack.com`
   - Décrivez **ce que vous avez fait** (clic par clic)
   - Décrivez **ce que vous attendiez**
   - Décrivez **ce qui s'est passé à la place**
   - Joignez une **capture d'écran** ou une **vidéo**
   - Précisez votre **OS** (Android 14, iOS 17, etc.) et le **modèle d'appareil**
2. Ou GitHub : https://github.com/Waoow-tech/DOUMASSI-Application/issues/new avec le préfixe `[BUG]`

### Pour une suggestion / idée

- Slack : `#beta-feedback` également, en préfixant par 💡

### Pour une question

- Slack : `#beta-questions` ou par email à `beta@doumassi.com`

## 6. Vie privée & sécurité

Pendant la bêta, vos données sont stockées sur nos serveurs Supabase (UE).

- Vous pouvez à tout moment **exporter** vos données (Paramètres → Compte → Exporter mes données)
- Vous pouvez à tout moment **supprimer** votre compte (Paramètres → Compte → Supprimer mon compte) avec un délai de récupération de 30 jours
- Vos données ne sont **jamais** vendues ni partagées avec des tiers à des fins publicitaires
- Pour toute question RGPD : `privacy@doumassi.com`

## 7. Qu'arrive-t-il après la bêta ?

À la fin de la bêta fermée, nous prévoyons :

1. Une mise à jour majeure incluant la marketplace et le studio AI
2. Un passage en bêta ouverte (TestFlight public + Play Store ouvert)
3. Une sortie publique sur les stores

Vos retours pendant cette phase fermée sont donc particulièrement précieux — ils orientent directement les prochaines versions.

---

**Merci de votre temps et de votre confiance ❤️**

_L'équipe DOUMASSI_
