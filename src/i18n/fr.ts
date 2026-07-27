// Dictionnaire FRANÇAIS — E11-01.
// Forme de référence : `type Translations = typeof fr`. en.ts doit couvrir
// exactement les mêmes clés (sinon erreur TypeScript).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel), sinon
// chaque valeur FR deviendrait un type littéral que l'anglais ne pourrait matcher.
// Tutoiement volontaire (cohérent avec le ton de l'app).
//
// Les sections splash/auth/profile/settings sont inline (fondation E11-01).
// Les zones traduites en E11-02→09 vivent chacune dans src/i18n/fr/<zone>.ts
// et sont agrégées ci-dessous par namespace.

import { aiFr } from './fr/ai';
import { commonFr } from './fr/common';
import { coursFr } from './fr/cours';
import { feedFr } from './fr/feed';
import { gamesFr } from './fr/games';
import { marketplaceFr } from './fr/marketplace';
import { matchingFr } from './fr/matching';
import { messagingFr } from './fr/messaging';
import { notificationsFr } from './fr/notifications';
import { profileScreensFr } from './fr/profileScreens';
import { walletFr } from './fr/wallet';

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
    // Bits partagés entre écrans auth (login + signup).
    common: {
      or: 'ou',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
    },
    login: {
      title: 'Connexion',
      identifierPlaceholder: 'Adresse e-mail ou numéro de téléphone',
      passwordPlaceholder: 'Mot de passe',
      submit: 'Se connecter',
      forgotPassword: 'Mot de passe oublié ?',
      createAccount: 'Créer un compte',
    },
    signup: {
      usernameChecking: 'Vérification…',
      usernameAvailable: 'Disponible',
      usernameTaken: 'Déjà pris',
      usernameCheckError: 'Vérification impossible, réessaie.',
      title: 'Créer un compte',
      fullNamePlaceholder: 'Nom complet',
      usernamePlaceholder: 'Nom d’utilisateur',
      identifierPlaceholder: 'E-mail ou numéro de téléphone',
      birthdayPlaceholder: 'Date de naissance (JJ/MM/AAAA)',
      passwordPlaceholder: 'Mot de passe',
      confirmPasswordPlaceholder: 'Confirme le mot de passe',
      submit: 'Créer un compte',
      termsAgree: 'J’accepte les',
      termsLink: 'Conditions d’utilisation',
      termsAnd: 'et la',
      privacyLink: 'Politique de confidentialité',
      orLogInWith: 'Ou connecte-toi avec',
      alreadyRegistered: 'Déjà inscrit ?',
      logIn: 'Se connecter',
    },
    completeAccount: {
      title: 'Complète ton compte',
      subtitle: 'Choisis un nom d’utilisateur et confirme ta date de naissance.',
      usernamePlaceholder: 'Nom d’utilisateur',
      birthdayPlaceholder: 'Date de naissance (JJ/MM/AAAA)',
      signOut: 'Se déconnecter',
      sessionExpired: 'Session expirée. Reconnecte-toi.',
      unexpectedError: 'Une erreur inattendue est survenue',
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
      selectedA11y: 'Photo de couverture sélectionnée',
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
    pendingDeletion: {
      title: 'Suppression programmée',
      bodyPrefix:
        'Tu as demandé la suppression de ton compte. Sans action, il sera supprimé définitivement le ',
      daysLeft: (n: number) => ` (dans ${n} jour${n > 1 ? 's' : ''})`,
      cancelPending: 'Annulation…',
      cancelButton: 'Annuler la demande',
      cancelA11y: 'Annuler la demande de suppression',
      manageButton: 'Gérer dans les paramètres',
      manageA11y: 'Ouvrir les paramètres du compte',
      laterButton: 'Plus tard',
      laterA11y: 'Fermer et continuer',
      cancelledTitle: 'Suppression annulée',
      cancelledMessage:
        'Bienvenue ! Ton compte est conservé. Tu peux refaire une demande à tout moment depuis Paramètres.',
      errorTitle: 'Erreur',
      errorFallback: 'Impossible d’annuler pour le moment. Réessaie.',
    },
    exportData: {
      dialogTitle: 'Exporter mes données DOUMASSI',
      sessionExpired: 'Session expirée. Reconnecte-toi puis réessaie.',
      failed: 'L’export a échoué. Réessaie dans un instant.',
    },
    // Messages de validation Zod (schémas login/signup/reset/complete-account).
    validation: {
      identifierRequired: 'Identifiant requis',
      invalidIdentifier: 'Entre un e-mail ou un numéro de téléphone valide',
      passwordMinLength: 'Le mot de passe doit contenir au moins 8 caractères',
      fullNameMinLength: 'Le nom complet doit contenir au moins 2 caractères',
      fullNameMaxLength: 'Le nom complet ne peut pas dépasser 100 caractères',
      bioMaxLength: 'La bio ne peut pas dépasser 250 caractères',
      emailRequired: 'E-mail requis',
      invalidEmail: 'Adresse e-mail invalide',
      birthdayRequired: 'Date de naissance requise',
      invalidDate: 'Date invalide (format attendu : JJ/MM/AAAA)',
      minAge: 'Tu dois avoir au moins 15 ans pour utiliser DOUMASSI',
      passwordUppercase: 'Le mot de passe doit contenir au moins une majuscule',
      passwordDigit: 'Le mot de passe doit contenir au moins un chiffre',
      confirmPasswordRequired: 'Confirme ton mot de passe',
      confirmationRequired: 'Confirmation requise',
      mustAcceptTerms: 'Tu dois accepter les Conditions d’utilisation',
      passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
      usernameMinLength: 'Le nom d’utilisateur doit contenir au moins 3 caractères',
      usernameMaxLength: 'Le nom d’utilisateur ne peut pas dépasser 30 caractères',
      usernameFormat:
        'Le nom d’utilisateur doit commencer par une lettre et ne contenir que des lettres, chiffres et underscores',
      usernameNoTrailingUnderscore:
        'Le nom d’utilisateur ne peut pas se terminer par un underscore',
      usernameFormatReserved: 'Ce format de nom d’utilisateur est réservé',
      usernameReserved: 'Ce nom d’utilisateur est réservé',
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
  feed: feedFr,
  profileScreens: profileScreensFr,
  messaging: messagingFr,
  notifications: notificationsFr,
  marketplace: marketplaceFr,
  cours: coursFr,
  games: gamesFr,
  common: commonFr,
  wallet: walletFr,
  matching: matchingFr,
  ai: aiFr,
};

export type Translations = typeof fr;
