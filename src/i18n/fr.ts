// Dictionnaire FRANÇAIS — E11-01.
// Forme de référence : `type Translations = typeof fr`. en.ts doit couvrir
// exactement les mêmes clés (sinon erreur TypeScript).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel), sinon
// chaque valeur FR deviendrait un type littéral que l'anglais ne pourrait matcher.
// Tutoiement volontaire (cohérent avec le ton de l'app).

export const fr = {
  splash: {
    tagline: 'DOUMASSI',
  },
  auth: {
    welcome: {
      tagline: 'La super-app française.',
      signIn: 'Se connecter',
      createAccount: 'Créer un compte',
    },
    signup: {
      usernameChecking: 'Vérification…',
      usernameAvailable: 'Disponible',
      usernameTaken: 'Déjà pris',
      usernameCheckError: 'Vérification impossible, réessaie.',
    },
    onboarding: {
      placeholderTitle: 'Presque fini !',
      placeholderSubtitle:
        'Complète ton profil pour commencer à utiliser DOUMASSI.\nLe parcours complet arrive bientôt.',
      continueToFeed: 'Passer pour l’instant',
    },
    coverPhoto: {
      title: 'Ajoute une photo de couverture',
      subtitle: 'Personnalise ton profil avec une bannière.',
      hint: 'Touche pour ajouter une photo de couverture.\nOn recommande une image large (1500×500px).',
      changeHint: 'Touche pour changer',
      takePhoto: 'Prendre une photo',
      chooseFromGallery: 'Choisir depuis la galerie',
      finishSetup: 'Terminer',
      skipForNow: 'Passer pour l’instant',
      errorGeneric: 'Une erreur inattendue est survenue',
    },
    settings: {
      title: 'Réglages',
      logoutSection: 'Compte',
      logoutButton: 'Se déconnecter',
      logoutConfirmTitle: 'Se déconnecter ?',
      logoutConfirmMessage: 'Tu seras déconnecté de ton compte DOUMASSI sur cet appareil.',
      logoutConfirmCancel: 'Annuler',
      logoutConfirmAction: 'Se déconnecter',
    },
    google: {
      continueWithGoogle: 'Continuer avec Google',
      callbackInProgress: 'Connexion en cours…',
      callbackError: 'La connexion Google a échoué. Réessaie.',
    },
    forgotPassword: {
      title: 'Mot de passe\noublié ?',
      subtitle:
        'Pas de souci ! Entre ton adresse e-mail et on t’envoie les instructions pour réinitialiser ton mot de passe.',
      emailPlaceholder: 'Adresse e-mail',
      submit: 'Envoyer les instructions',
      backToLogin: 'Retour à la connexion',
      successMessage:
        'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé. Vérifie tes spams si tu ne le vois pas.',
    },
    resetPassword: {
      title: 'Nouveau\nmot de passe',
      subtitle: 'Choisis un nouveau mot de passe pour finaliser la réinitialisation.',
      passwordPlaceholder: 'Nouveau mot de passe',
      confirmPlaceholder: 'Confirme le mot de passe',
      submit: 'Mettre à jour le mot de passe',
      successMessage: 'Mot de passe mis à jour. Tu peux maintenant te connecter.',
      invalidLink:
        'Ce lien de réinitialisation est invalide ou expiré. Demandes-en un nouveau depuis l’écran de connexion.',
    },
    errors: {
      weakPassword: 'Mot de passe trop faible (8 caractères minimum).',
      samePassword: 'Le nouveau mot de passe doit être différent de l’ancien.',
      emailAlreadyUsed: 'Un compte existe déjà avec cet e-mail. Essaie plutôt de te connecter.',
      invalidCredentials: 'E-mail/téléphone ou mot de passe incorrect.',
      emailNotConfirmed: 'Confirme ton e-mail avant de te connecter.',
      invalidIdentifier: 'Entre un e-mail ou un numéro de téléphone valide.',
      rateLimit: 'Trop de tentatives. Réessaie dans quelques minutes.',
      invalidEmail: 'Adresse e-mail invalide.',
      userNotFound: 'Aucun compte ne correspond à cette adresse e-mail.',
      expiredLink: 'Lien expiré. Demande un nouvel e-mail de réinitialisation.',
      network: 'Problème réseau. Vérifie ta connexion et réessaie.',
      unknown: 'Une erreur inattendue est survenue. Réessaie.',
    },
  },
  profile: {
    stats: {
      posts: 'Publications',
      followers: 'Abonnés',
      following: 'Abonnements',
    },
    editButton: 'Modifier',
    shareButton: 'Partager',
    shareMessage: 'Découvre mon profil sur DOUMASSI ! 🚀',
    verifiedBadge: 'Vérifié',
    kebabMenu: {
      settings: 'Paramètres',
      shareProfile: 'Partager mon profil',
      cancel: 'Annuler',
    },
    tabs: {
      grid: 'Grille',
      reels: 'Reels',
      tagged: 'Identifié',
    },
    emptyState: {
      title: 'Aucune publication pour l’instant',
    },
  },
  settings: {
    languageTitle: 'Langue',
    languageSubtitle: 'Choisis la langue de l’application',
    languageFr: 'Français',
    languageEn: 'English',
  },
};

export type Translations = typeof fr;
