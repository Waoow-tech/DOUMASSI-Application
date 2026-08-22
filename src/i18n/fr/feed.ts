// Dictionnaire FRANÇAIS — namespace `feed` (E11-02).
// Fil d'actualité, posts, stories, mentions, commentaires, Business Hub,
// partage interne. Tutoiement (cohérent avec le ton de l'app).
// Les libellés dynamiques sont des fonctions (mêmes signatures côté EN).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel).

export const feedFr = {
  // Temps relatif « Il y a X » — PostCard + écran de détail d'un post.
  time: {
    justNow: 'Il y a quelques instants',
    minutes: (n: number) => `Il y a ${n}min`,
    hours: (n: number) => `Il y a ${n}h`,
    days: (n: number) => `Il y a ${n}j`,
    weeks: (n: number) => `Il y a ${n}sem`,
    months: (n: number) => `Il y a ${n}mois`,
    years: (n: number) => `Il y a ${n}an`,
  },

  // Onglets du haut du Feed + placeholders des verticales pas encore livrées.
  tabs: {
    // Libellés d'onglets — gardés identiques FR/EN (branding produit).
    social: 'Social',
    business: 'Business',
    ai: 'AI',
    wallet: 'Wallet',
    soon: 'Soon',
    openTabA11y: (label: string) => `Ouvrir l’onglet ${label}`,
    placeholders: {
      business: {
        title: 'Marketplace bientôt disponible',
        subtitle: 'Achetez, vendez, découvrez.',
      },
      ai: {
        title: 'Doumassi AI bientôt disponible',
        subtitle: 'Assistant IA, génération d’images et plus.',
      },
      wallet: {
        title: 'Dpay bientôt disponible',
        subtitle: 'Votre wallet crypto intégré.',
      },
      soon: {
        title: 'Encore plus à venir',
        subtitle: 'DOUMASSI évolue. Restez connecté.',
        manifest:
          'Un espace social, business, créatif et financier pensé pour rassembler vos usages dans un seul univers.',
      },
    },
  },

  // Chrome de l'écran Feed — FeedScreen.tsx
  screen: {
    openProfileA11y: 'Ouvrir mon profil',
    openSettingsA11y: 'Ouvrir les paramètres',
    searchPostsPlaceholder: 'Rechercher des posts...',
    searchPlaceholder: 'Rechercher...',
    emptyTitle: 'Suivez des comptes pour voir leurs posts ici',
    emptyDiscover: 'Découvrir des comptes',
    createPostA11y: 'Créer un post',
    toastShareFailed: 'Partage impossible, réessayez',
    toastPostDeleted: 'Post supprimé',
    toastDeleteFailed: 'Suppression impossible, réessayez',
    toastPostHidden: 'Post masqué',
    undo: 'Annuler',
    toastDisplayRestored: 'Affichage restauré',
    toastHideFailed: 'Masquage impossible, réessayez',
    toastLinkCopied: 'Lien copié',
  },

  // Stories
  stories: {
    // Barre de stories au-dessus du fil — FeedStories.tsx
    bar: {
      addStoryA11y: 'Ajouter à votre story',
      openStoryA11y: (username: string) => `Ouvrir la story de @${username}`,
      createStoryHint: 'Tap pour créer une nouvelle story',
      viewStoryHint: (username: string) => `Tap pour visionner la story de @${username}`,
      yourStory: 'Votre story',
    },

    // Visionneuse plein écran — StoryViewerScreen.tsx
    viewer: {
      time: {
        justNow: 'à l’instant',
        minutes: (n: number) => `${n}min`,
        hours: (n: number) => `${n}h`,
      },
      errorTitle: 'Aucune story à afficher',
      back: 'Retour',
      previousA11y: 'Story précédente',
      previousHint: 'Tap pour revenir à la story précédente',
      resume: 'Reprendre',
      pause: 'Pause',
      resumeHint: 'Tap pour reprendre la lecture',
      pauseHint: 'Tap pour mettre en pause',
      nextA11y: 'Story suivante',
      nextHint: 'Tap pour passer à la story suivante',
      openAuthorA11y: (username: string) => `Ouvrir le profil de @${username}`,
      close: 'Fermer',
      seenByA11y: 'Voir qui a vu cette story',
      seenByHint: 'Voir la liste des personnes ayant vu cette story',
      seenBy: 'Vu par',
    },

    // Sheet « Vu par » — StoryViewersSheet.tsx
    viewers: {
      time: {
        justNow: 'à l’instant',
        minutesAgo: (n: number) => `il y a ${n}min`,
        hoursAgo: (n: number) => `il y a ${n}h`,
        daysAgo: (n: number) => `il y a ${n}j`,
      },
      viewsLabel: (n: number) => `${n} ${n > 1 ? 'vues' : 'vue'}`,
      empty: 'Personne n’a encore vu cette story',
    },

    // Écran de création de story — CreateStoryScreen.tsx
    create: {
      videoTooLongTitle: 'Vidéo trop longue',
      videoTooLongMessage: (max: number) => `La vidéo doit faire ${max} secondes maximum.`,
      errorTitle: 'Erreur',
      recordingFailed: 'L’enregistrement vidéo a échoué. Vérifiez les permissions micro.',
      permissionDeniedTitle: 'Permission refusée',
      photoPermissionMessage: 'Activez l’accès aux photos dans les Réglages.',
      retake: 'Recommencer',
      publish: 'Publier',
      publishErrorFallback: 'Erreur lors de la publication.',
      cameraPermissionMessage:
        'Activez l’accès à la caméra dans les Réglages pour utiliser les stories.',
      back: 'Retour',
      closeCameraA11y: 'Fermer la caméra',
      photoModeA11y: 'Mode photo',
      videoModeA11y: 'Mode vidéo',
      photo: 'Photo',
      video: 'Vidéo',
      switchCameraA11y: 'Changer de caméra (avant / arrière)',
      pickFromGalleryA11y: 'Choisir depuis la galerie',
      takePhotoA11y: 'Prendre une photo',
      holdToRecordA11y: 'Maintenir pour enregistrer une vidéo',
    },
  },

  // Carte de post — PostCard.tsx (a11y réutilisés par l'écran de détail).
  postCard: {
    viewProfileA11y: (username: string) => `Voir le profil de @${username}`,
    openPost: 'Ouvrir le post',
    openPostMedia: 'Ouvrir le media du post',
    seeMore: '...plus',
    openMenuA11y: (username: string) => `Ouvrir le menu du post de @${username}`,
    likeA11y: (username: string) => `Aimer le post de @${username}`,
    likeHintAdd: 'Tap pour aimer ce post',
    likeHintRemove: 'Tap pour retirer votre like',
    commentA11y: (username: string) => `Commenter le post de @${username}`,
    shareA11y: (username: string) => `Partager le post de @${username}`,
    bookmarkA11y: (username: string) => `Sauvegarder le post de @${username}`,
    bookmarkHintAdd: 'Tap pour sauvegarder ce post dans vos favoris',
    bookmarkHintRemove: 'Tap pour retirer ce post de vos favoris',
  },

  // Écran de détail d'un post — app/(feed)/post/[id].tsx
  postDetail: {
    errorTitle: 'Post indisponible',
    back: 'Retour',
    toggleOverlaysA11y: 'Afficher ou masquer les contrôles du post',
    closeA11y: 'Fermer le post',
  },

  // Menu contextuel d'un post — PostMenuSheet.tsx
  postMenu: {
    share: 'Partager',
    copyLink: 'Copier le lien',
    delete: 'Supprimer',
    hide: 'Masquer ce post',
    report: 'Signaler',
    linkCopiedTitle: 'Lien copié',
    linkCopiedMessage: 'Le lien du post est prêt à être partagé.',
    reportTitle: 'Signalement',
    reportMessage: 'Cette action sera disponible au Sprint 4.',
    deleteTitle: 'Supprimer ce post ?',
    deleteMessage: 'Cette action est irréversible. Le post sera retiré du feed.',
    cancel: 'Annuler',
    deleteConfirm: 'Supprimer',
  },

  // Options de partage interne/externe — InternalShareOptionsSheet.tsx
  share: {
    outside: 'Partager hors DOUMASSI',
    inside: 'Envoyer dans DOUMASSI',
  },

  // Commentaires — CommentsSheet.tsx + CommentCard.tsx
  comments: {
    title: 'Commentaires',
    closeA11y: 'Fermer les commentaires',
    empty: 'Soyez le premier à commenter !',
    reply: 'Répondre',
    replyA11y: (username: string) => `Répondre à @${username}`,
    likeA11y: (username: string) => `Aimer le commentaire de @${username}`,
    replyingTo: (username: string) => `Réponse à @${username}`,
    cancelReplyA11y: 'Annuler la réponse',
    inputPlaceholder: 'Ajouter un commentaire...',
    deleteTitle: 'Supprimer ce commentaire ?',
    deleteMessage: 'Cette action retirera le commentaire du post.',
    cancel: 'Annuler',
    delete: 'Supprimer',
    sendErrorTitle: 'Commentaire non envoyé',
    sendErrorMessage: (message: string) => `${message} Réessayez dans un instant.`,
    publishErrorFallback: 'Impossible de publier ce commentaire pour le moment.',
    // Temps relatif compact (sans préfixe) — CommentCard.tsx
    time: {
      minutes: (n: number) => `${n}min`,
      hours: (n: number) => `${n}h`,
      days: (n: number) => `${n}j`,
      weeks: (n: number) => `${n}sem`,
      months: (n: number) => `${n}mois`,
      years: (n: number) => `${n}an`,
    },
  },

  // Mentions — MentionSuggestionsList.tsx + MentionsText.tsx
  mentions: {
    searching: 'Recherche…',
    noResults: 'Aucun utilisateur trouvé',
    mentionA11y: (username: string) => `Mentionner @${username}`,
    profileA11y: (username: string) => `Profil de ${username}`,
  },

  // Écran « Créer un post » — CreatePostScreen.tsx
  createPost: {
    discardTitle: 'Abandonner le post ?',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    photoPermissionTitle: 'Permission refusée',
    photoPermissionMessage: 'Activez l’accès aux photos dans les Réglages pour ajouter des images.',
    cameraPermissionMessage: 'Activez l’accès à la caméra dans les Réglages.',
    title: 'Nouveau post',
    publish: 'Publier',
    contentPlaceholder: 'Quoi de neuf ?',
    uploadFailed: (n: number) => `Échec d’upload sur ${n} image${n > 1 ? 's' : ''}.`,
    retry: 'Réessayer',
    tooManyMentions: (max: number) => `Maximum ${max} mentions par post.`,
    imagesCount: (n: number, max: number) => `${n}/${max} images`,
    // Vidéo — E14-01
    videoPermissionMessage: 'Activez l’accès aux photos dans les Réglages pour ajouter une vidéo.',
    videoTooLongTitle: 'Vidéo trop longue',
    videoTooLongMessage: (secs: number) => `Choisissez une vidéo de ${secs} secondes maximum.`,
    videoWithImagesTitle: 'Un seul type de média',
    videoWithImagesMessage:
      'Un post contient soit des images, soit une vidéo — pas les deux. Retirez les médias déjà ajoutés pour changer.',
    videoLabel: '1 vidéo',
    videoPreparing: 'Préparation de la vidéo…',
    // Suggestion de légende IA — E5-14
    aiCaption: {
      button: '✨ Suggérer avec l’IA',
      loading: 'Génération…',
      sheetTitle: 'Suggestions de légende',
      sheetSubtitle: 'Tape une suggestion pour l’utiliser.',
      regenerate: 'Régénérer',
      close: 'Fermer',
      errorTitle: 'Suggestion impossible',
      errorGeneric: 'Impossible de générer une légende pour le moment. Réessaie.',
      errorQuota: 'Tu as atteint ta limite d’IA du jour. Réessaie demain.',
      a11ySuggestion: (text: string) => `Utiliser la légende : ${text}`,
    },
  },

  // Écran des posts sauvegardés — BookmarksScreen.tsx
  bookmarks: {
    back: 'Retour',
    title: 'Sauvegardés',
    emptyTitle: 'Vous n’avez encore rien sauvegardé',
    emptySubtitle: 'Tap sur le marque-page d’un post pour le retrouver ici',
  },

  // Business Hub — grille des verticales — BusinessHub.tsx
  businessHub: {
    seeMore: 'Voir plus',
    comingSoon: 'Bientôt disponible',
    openCategoryA11y: (label: string) => `Ouvrir ${label}`,
    comingSoonA11y: (label: string) => `${label} — bientôt disponible`,
    categories: {
      marketplace: 'MARKETPLACE',
      films: 'FILMS',
      immobilier: 'IMMOBILIER',
      jeux: 'JEUX',
      musique: 'MUSIQUE',
      cours: 'COURS',
    },
  },

  // Recherche d'utilisateurs depuis le feed — app/(feed)/search.tsx
  search: {
    placeholder: 'Rechercher des utilisateurs...',
    emptyState: 'Recherche par nom d’utilisateur ou nom',
    searchError: 'Recherche impossible. Réessayez.',
    noResults: (query: string) => `Aucun utilisateur trouvé pour '@${query}'`,
    clearSearch: 'Effacer la recherche',
  },
};

export type FeedTranslations = typeof feedFr;
