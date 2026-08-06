// Dictionnaire FRANÇAIS du namespace `profileScreens` — E11-03 Profil.
// Regroupe les chaînes des écrans Profil (édition, followers/following,
// blocage) et des Réglages (settings + sous-écrans blocked / change-password /
// delete-account / hidden-posts).
//
// ⚠️ PAS de `as const` (cf. fr.ts) : on veut des valeurs typées `string` pour
// que l'anglais puisse matcher structurellement.
// Tutoiement volontaire, cohérent avec le ton de l'app.

export const profileScreensFr = {
  // Libellés réutilisés par plusieurs écrans/composants.
  common: {
    cancel: 'Annuler',
    goBack: 'Retour',
    back: 'Retour',
    takePhoto: 'Prendre une photo',
    chooseFromGallery: 'Choisir depuis la galerie',
    logoAccessibilityLabel: 'Logo DOUMASSI',
  },

  profileHeader: {
    kebabAccessibilityLabel: 'Plus d’options',
  },

  searchBar: {
    placeholder: 'Rechercher…',
  },

  unfollowModal: {
    title: (username: string) => `Ne plus suivre @${username} ?`,
    message: 'Tu ne verras plus ses publications.',
    confirm: 'Ne plus suivre',
  },

  blockModal: {
    title: (username: string) => `Bloquer @${username} ?`,
    message:
      'Cette personne ne pourra plus trouver ton profil, tes publications ni te contacter. Elle ne sera pas notifiée.',
    confirm: 'Bloquer',
  },

  followButton: {
    follow: 'Suivre',
    requested: 'Demandé ✕',
    following: 'Abonné',
  },

  followRelation: {
    followersTab: 'Abonnés',
    followingTab: 'Abonnements',
    follow: 'Suivre',
    followBack: 'Suivre en retour',
    following: 'Abonné',
    requested: 'Demandé',
    searchFollowers: 'Rechercher des abonnés…',
    searchFollowing: 'Rechercher des abonnements…',
    noFollowers: 'Aucun abonné pour le moment',
    noFollowersSubtitle: 'Partage ton profil pour commencer',
    noFollowing: 'Tu ne suis personne pour le moment',
    noFollowingSubtitle: 'Découvre des personnes à suivre',
  },

  listingCard: {
    badgePromo: 'Promo',
    badgeNew: 'Nouveau',
    badgeReco: 'Reco',
    viewProduct: 'Voir le produit',
    viewProductAccessibility: (title: string, price: string) =>
      `Voir le produit ${title}, ${price}`,
  },

  shopEmptyState: {
    noListingsMine: 'Aucune annonce pour le moment',
    noListingsOther: 'Aucun produit en vente',
    publishFirst: 'Publier ta première annonce',
  },

  completeProfile: {
    title: 'Complète ton profil',
    subtitle: 'Aide les autres à te reconnaître sur\nDOUMASSI.',
    addPhoto: 'Ajoute une photo de profil',
    genderOptional: 'Genre (optionnel)',
    genderLabels: {
      male: 'Homme',
      female: 'Femme',
      other: 'Autre',
    },
    bioPlaceholder: 'Bio (optionnel)',
    professionalAccount: 'Compte professionnel',
    professionalHint:
      'Ton compte peut être utilisé pour promouvoir du contenu et des produits liés à ta profession.',
    continue: 'Continuer',
    skip: 'Passer pour l’instant',
    errorGeneric: 'Une erreur inattendue est survenue',
  },

  editProfile: {
    title: 'Modifier le profil',
    changePhoto: 'Changer la photo',
    notSet: 'Non renseigné',
    fullNameLabel: 'Nom complet',
    fullNamePlaceholder: 'Nom complet',
    usernameLabel: 'Nom d’utilisateur',
    usernamePlaceholder: 'nom d’utilisateur',
    usernameCooldownInline: (nextDate: string, days: number) =>
      `Tu pourras changer ton nom d’utilisateur le ${nextDate} (${days} jours restants)`,
    usernameChecking: 'Vérification du nom d’utilisateur…',
    usernameTaken: 'Ce nom d’utilisateur est déjà pris',
    usernameAvailable: 'Nom d’utilisateur disponible',
    bioLabel: 'Bio',
    bioPlaceholder: 'Bio',
    birthdayLabel: 'Anniversaire',
    birthdayHint: 'L’anniversaire ne peut pas être modifié. Contacte le support si besoin.',
    emailLabel: 'E-mail',
    coverPhoto: 'Photo de couverture',
    changeCover: 'Changer la couverture',
    professionalAccount: 'Compte professionnel',
    professionalHint: 'Affiche ton profil en tant que compte professionnel.',
    save: 'Enregistrer',
    profileSaved: 'Profil enregistré',
    cooldownAlertTitle: 'Délai nom d’utilisateur',
    cooldownAlertMessage: (nextDate: string) =>
      `Tu pourras changer ton nom d’utilisateur le ${nextDate}`,
    updateFailed: 'La mise à jour du profil a échoué.',
    couldNotSave: 'Impossible d’enregistrer le profil',
    unavailableTitle: 'Profil indisponible',
    unavailableMessage: 'Réessaie dans un instant.',
  },

  otherProfile: {
    userNotAvailable: 'Utilisateur indisponible',
    blockErrorTitle: 'Erreur',
    blockErrorMessage: 'Impossible de bloquer cet utilisateur. Réessaie.',
    report: 'Signaler',
    reportMessage: 'La fonction de signalement arrive bientôt.',
    // Signalement de profil — Sécu B2
    reportSheet: {
      title: 'Signaler ce profil',
      reasons: {
        inapproprie: 'Contenu inapproprié',
        harcelement: 'Harcèlement ou intimidation',
        spam: 'Spam ou arnaque',
        faux_profil: 'Faux profil / usurpation',
        autre: 'Autre',
      },
      successTitle: 'Merci',
      successMessage: 'Ton signalement a été transmis à la modération.',
      errorTitle: 'Signalement impossible',
      errorOwn: 'Tu ne peux pas signaler ton propre profil.',
      errorGeneric: 'Une erreur est survenue. Réessaie.',
    },
    shareMessage: (username: string) =>
      `Découvre le profil de @${username} sur DOUMASSI ! 🚀\nhttps://doumassi.app/u/${username}`,
    messageButton: 'Message',
    userNotFound: 'Utilisateur introuvable',
    userNotFoundSubtitle: 'Ce compte a peut-être été supprimé ou n’existe pas.',
    accountPrivate: (username: string) =>
      `Ce compte est privé.\nSuis @${username} pour voir ses publications.`,
    shareProfile: 'Partager le profil',
    blockUser: (username: string) => `Bloquer @${username}`,
    userBlockedToast: 'Utilisateur bloqué',
  },

  resolveUsername: {
    notFoundTitle: 'Utilisateur introuvable',
    notFoundMessage: (username: string) => `@${username} n’existe pas ou a été supprimé.`,
    invalidUsername: 'Nom d’utilisateur invalide.',
    errorTitle: 'Erreur de chargement',
  },

  settings: {
    title: 'Réglages',
    profileUnavailable: 'Profil indisponible.',
    backAccessibilityLabel: 'Retour',
    sectionPrivacy: 'Confidentialité',
    sectionNotifications: 'Notifications',
    sectionAccount: 'Compte',
    sectionFeatures: 'Fonctionnalités DOUMASSI',
    sectionModeration: 'Modération',
    sectionLegal: 'Légal',
    sectionHelp: 'Aide',
    privateProfile: 'Profil privé',
    hiddenPosts: 'Posts masqués',
    pushNotifications: 'Notifications push',
    emailNotifications: 'Notifications email',
    editProfile: 'Modifier mon profil',
    changePassword: 'Changer le mot de passe',
    exportData: 'Exporter mes données',
    deleteAccount: 'Supprimer mon compte',
    blockedUsers: 'Utilisateurs bloqués',
    terms: 'Conditions d’utilisation',
    privacyPolicy: 'Politique de confidentialité',
    contactUs: 'Nous contacter',
    about: 'À propos',
    featureWallet: 'Portefeuille',
    featureMatching: 'Mise en relation',
    featureAi: 'Intelligence Art.',
    featureMarketplace: 'Marketplace',
    featureMessaging: 'Messagerie',
    featureCalls: 'Appels',
    badgeSoon: 'Bientôt',
    profileCardUserFallback: 'Utilisateur',
    profileCardNoEmail: 'Pas d’e-mail',
    soonTitle: 'Bientôt disponible',
    soonMessage: 'Cette fonctionnalité arrive prochainement.',
    privacyErrorTitle: 'Mise à jour impossible',
    privacyErrorMessage: 'Le changement de confidentialité a échoué. Réessaie dans un instant.',
    exportPartialTitle: 'Export partiel',
    exportPartialMessage:
      'Ton export contient un très grand volume de données. Les messages les plus anciens ont été tronqués. Contacte le support pour un export complet.',
    exportFailedTitle: 'Export impossible',
    exportFailedMessage: 'L’export a échoué. Réessaie dans un instant ou contacte le support.',
    aboutVersion: 'Version 1.0.0 — MVP juin 2026',
    aboutRights: '© 2026 DOUMASSI. Tous droits réservés.',
  },

  changePassword: {
    title: 'Changer le mot de passe',
    currentPasswordLabel: 'Mot de passe actuel',
    newPasswordLabel: 'Nouveau mot de passe',
    confirmPasswordLabel: 'Confirmer le nouveau mot de passe',
    currentPasswordRequired: 'Mot de passe actuel requis',
    passwordMinLength: 'Le mot de passe doit contenir au moins 8 caractères',
    passwordUppercase: 'Le mot de passe doit contenir au moins 1 majuscule',
    passwordDigit: 'Le mot de passe doit contenir au moins 1 chiffre',
    confirmationRequired: 'Confirmation requise',
    newPasswordDifferent: 'Le nouveau mot de passe doit être différent',
    passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
    samePasswordError: 'Le nouveau mot de passe doit être différent de l’ancien',
    submit: 'Mettre à jour le mot de passe',
    toast: 'Mot de passe mis à jour',
    emailUnavailable: 'E-mail du compte indisponible',
    currentPasswordIncorrect: 'Mot de passe actuel incorrect',
  },

  deleteAccount: {
    title: 'Supprimer mon compte',
    cancelledTitle: 'Demande annulée',
    cancelledMessage: 'Ta demande de suppression a été annulée. Ton compte reste actif.',
    errorTitle: 'Erreur',
    cancelFailedMessage: 'L’annulation a échoué. Réessaie dans un instant ou contacte le support.',
    scheduledTitle: 'Suppression programmée',
    scheduledBefore: 'Ton compte sera définitivement supprimé le ',
    scheduledHint:
      'Tu peux annuler cette demande à tout moment avant cette date en revenant ici. Une fois la date passée, la suppression est définitive et irréversible.',
    reasonGiven: 'Raison transmise',
    cancelRequestButton: 'Annuler la demande de suppression',
    irreversibleTitle: 'Action irréversible',
    irreversibleMessage:
      'Toutes tes données seront supprimées 30 jours après ta demande. Tu peux annuler à tout moment avant cette échéance.',
    whatWillBeDeleted: 'Ce qui sera supprimé',
    deletedItems: [
      'Ton profil (photo, bio, nom d’utilisateur)',
      'Tes publications et commentaires',
      'Tes messages privés',
      'Tes abonnés et abonnements',
      'Ton historique de connexion',
    ],
    reasonLabel: 'Pourquoi nous quittes-tu ? (optionnel)',
    reasonPlaceholder: 'Ton retour nous aide à améliorer DOUMASSI…',
    requestButton: 'Demander la suppression de mon compte',
    sureTitle: 'En es-tu sûr ?',
    confirmBefore: 'Tape ',
    confirmAfter: ' pour confirmer la suppression de ton compte.',
    confirmDelete: 'Confirmer la suppression',
    requestFailedMessage: 'La demande n’a pas pu être enregistrée. Réessaie dans un instant.',
    requestRecordedTitle: 'Demande enregistrée',
    requestRecordedMessage:
      'Ton compte sera supprimé dans 30 jours. Reconnecte-toi avant cette date pour annuler.',
  },

  blockedUsers: {
    title: 'Utilisateurs bloqués',
    unblock: 'Débloquer',
    unblockErrorTitle: 'Déblocage impossible',
    unblockErrorMessage: 'Réessaie dans un instant.',
    emptyTitle: 'Aucun utilisateur bloqué',
    emptySubtitle: 'Tu n’as bloqué personne pour le moment.',
    unblockedToast: 'Utilisateur débloqué',
  },

  hiddenPosts: {
    title: 'Posts masqués',
    loading: 'Chargement…',
    postUnavailable: 'Post indisponible',
    restore: 'Réafficher',
    emptyTitle: 'Aucun post masqué',
    restoredToast: 'Affichage restauré',
  },
};

export type ProfileScreensTranslations = typeof profileScreensFr;
