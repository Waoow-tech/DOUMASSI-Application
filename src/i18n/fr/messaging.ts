// Dictionnaire FRANÇAIS — namespace `messaging` (E11-04).
// Messagerie + Appels. Tutoiement (cohérent avec le ton de l'app).
// Les libellés dynamiques sont des fonctions (mêmes signatures côté EN).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel).

export const messagingFr = {
  // Chaînes partagées par plusieurs écrans de la messagerie.
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    clearSearch: 'Effacer la recherche',
    searchByUsernameOrName: 'Recherchez par username ou nom',
    searchError: 'Recherche impossible. Réessayez.',
    noResultsFor: (query: string) => `Aucun utilisateur trouvé pour '@${query}'`,
  },

  // Onglet liste des conversations — app/(tabs)/messages.tsx
  list: {
    title: 'Messages',
    emptyState: 'Aucune conversation, démarrez-en une avec le +',
    newConversationA11y: 'Nouvelle conversation',
    errorTitle: 'Impossible de charger tes conversations',
    errorSubtitle: 'Vérifie ta connexion et réessaie.',
    errorRetry: 'Réessayer',
  },

  // Ligne de conversation dans la liste — ConversationRow.tsx
  conversationRow: {
    noMessage: 'Aucun message',
    conversationWith: (name: string) => `Conversation avec ${name}`,
    time: {
      now: 'maintenant',
      minutesAgo: (n: number) => `${n} min`,
      hoursAgo: (n: number) => `${n} h`,
      daysAgo: (n: number) => `${n} j`,
    },
  },

  // Écran de conversation (fil de messages) — ConversationScreen.tsx
  conversation: {
    replyAuthorSelf: 'votre message',
    replyAuthorUnknown: '@un membre',
    replyAuthorFallback: 'Message',
    attachmentPhoto: '📷 Photo',
    attachmentVoice: '🎙️ Message vocal',
    attachmentVideo: '🎬 Vidéo',
    replyParentUnloaded: 'Faire défiler pour voir le message original…',
    sendErrorTitle: 'Échec de l’envoi',
    uploadErrorTitle: 'Échec de l’upload',
    uploadFailedFallback: 'Upload échoué',
    uploadAudioFailedFallback: 'Upload audio échoué',
    attachSheetTitle: 'Ajouter une image',
    galleryOption: 'Galerie',
    cameraOption: 'Caméra',
    permissionDeniedTitle: 'Permission refusée',
    photoPermissionMessage: 'Active l’accès aux photos dans Réglages.',
    cameraPermissionMessage: 'Active l’accès à la caméra dans Réglages.',
    parentNotLoadedTitle: 'Message non chargé',
    parentNotLoadedMessage:
      'Le message parent est trop ancien. Faites défiler vers le haut puis réessayez.',
    realtimeDown: 'Connexion temps réel indisponible — tirez pour rafraîchir',
    emptyConversation: 'Aucun message. Démarre la conversation 👋',
  },

  // Bulle de message — MessageBubble.tsx
  bubble: {
    deletedMessage: '🚫 Message supprimé',
    goToReplyA11y: (author: string) => `Aller au message de ${author}`,
    imageSentA11y: 'Image envoyée',
    sendFailed: 'Échec — taper pour réessayer',
    edited: 'modifié',
  },

  // Message vocal — VoiceMessage.tsx
  voice: {
    pauseA11y: 'Mettre en pause',
    playA11y: 'Lire le message vocal',
  },

  // Composer — MessageInput.tsx
  input: {
    placeholder: 'Écrire un message…',
    replyingTo: (author: string) => `Réponse à ${author}`,
    cancelReplyA11y: 'Annuler la réponse',
    tooManyMentions: (max: number) => `Maximum ${max} mentions par message.`,
    recording: (current: number, max: number) => `Enregistrement… ${current}s / ${max}s`,
    addImageA11y: 'Ajouter une image',
    addImageHint: 'Tap pour ouvrir la galerie ou prendre une photo',
    stopRecordingA11y: 'Arrêter l’enregistrement',
    recordVoiceA11y: 'Enregistrer un vocal',
    stopRecordingHint: 'Tap pour arrêter et envoyer l’enregistrement',
    recordVoiceHint: 'Tap pour commencer un enregistrement vocal',
    sendA11y: 'Envoyer le message',
  },

  // Menu contextuel long-press — MessageActionSheet.tsx
  actionSheet: {
    reply: 'Répondre',
    edit: 'Modifier',
    delete: 'Supprimer',
    editHeader: 'Modifier le message',
    editPlaceholder: 'Tape ton message…',
    save: 'Enregistrer',
    replyA11y: 'Répondre à ce message',
    editA11y: 'Modifier ce message',
    deleteA11y: 'Supprimer ce message',
    emptyContentTitle: 'Contenu vide',
    emptyContentMessage: 'Le message ne peut pas être vide.',
    editFailedTitle: 'Édition impossible',
    deleteFailedTitle: 'Suppression impossible',
    retryLater: 'Réessayez dans un instant.',
    deleteConfirmTitle: 'Supprimer ce message ?',
    deleteConfirmMessage:
      'Le contenu sera remplacé par « Message supprimé » pour tous les participants. Action irréversible.',
    deleteAction: 'Supprimer',
  },

  // Nouvelle conversation (DM + groupe) — app/messages/new.tsx
  newConversation: {
    toggleDmA11y: 'Nouvelle conversation 1-to-1',
    toggleGroupA11y: 'Nouveau groupe',
    toggleDmLabel: 'Conversation',
    toggleGroupLabel: 'Groupe',
    titleDm: 'Nouvelle conversation',
    titleGroup: 'Nouveau groupe',
    groupNamePlaceholder: 'Nom du groupe',
    groupNameA11y: 'Nom du groupe',
    removeParticipantA11y: (username: string) => `Retirer @${username}`,
    searchUserPlaceholder: 'Rechercher un utilisateur...',
    addMembersPlaceholder: 'Ajouter des membres...',
    searchUserA11y: 'Rechercher un utilisateur',
    searchGroupA11y: 'Rechercher pour ajouter au groupe',
    searchHintGroup: 'Recherchez et tape sur les membres pour les ajouter',
    createGroupFailedFallback: 'Création échouée',
    createGroupA11y: 'Créer le groupe',
    creating: 'Création…',
    createGroupButton: (count: number) => `Créer le groupe (${count})`,
  },

  // Partage vers un message — app/messages/share.tsx
  share: {
    toastSelectOther: 'Choisissez un autre utilisateur',
    toastSent: 'Envoyé dans DOUMASSI',
    toastSendFailed: 'Envoi impossible, réessayez',
    title: 'Envoyer dans DOUMASSI',
    searchPlaceholder: 'Rechercher un utilisateur...',
    linkUnavailable: 'Lien à partager indisponible.',
  },

  // Messages d'erreur remontés par les hooks (surfacés via Alert/state).
  errors: {
    groupNameRequired: 'Le nom du groupe est requis',
    groupNameTooLong: 'Nom trop long (max 80 caractères)',
    participantRequired: 'Sélectionne au moins un participant',
    invalidRpcResponse: 'Réponse RPC invalide',
    messageEmpty: 'Message vide',
    messageTooLong: (max: number) => `Message trop long (max ${max} caractères)`,
    attachmentUrlRequired: 'Attachment URL requise pour ce type de message',
    sessionExpired: 'Session expirée. Reconnectez-vous.',
    editContentEmpty: 'Contenu vide',
  },

  // Nom d'affichage de repli quand l'autre participant a supprimé son compte.
  deletedAccount: 'Compte supprimé',

  // Appels audio/vidéo (Daily.co).
  calls: {
    startErrorTitle: 'Impossible de lancer l’appel',
    startInvalidResponse: 'Réponse Edge Function invalide',
    audioCallA11y: 'Appel audio',
    videoCallA11y: 'Appel vidéo',
    audioCallHint: (name: string) => `Tap pour appeler ${name} en audio`,
    videoCallHint: (name: string) => `Tap pour appeler ${name} en vidéo`,

    // Entrée d'appel dans la timeline — CallEntry.tsx
    entry: {
      noAnswer: 'Appel sans réponse',
      missed: 'Appel manqué',
      rejectedByRecipient: 'Appel refusé par le destinataire',
      rejected: 'Appel refusé',
      cancelled: 'Appel annulé',
      videoCall: 'Appel vidéo',
      audioCall: 'Appel audio',
      tapToRecall: 'Tap pour rappeler.',
    },

    // Écran d'appel en cours — app/call/[id].tsx
    active: {
      connecting: 'Appel en cours…',
      ended: 'Appel terminé',
      connectingToRoom: 'Connexion à la room…',
      muteMicA11y: 'Couper le micro',
      unmuteMicA11y: 'Réactiver le micro',
      turnOffCameraA11y: 'Couper la caméra',
      turnOnCameraA11y: 'Activer la caméra',
      switchCameraA11y: 'Changer de caméra',
      hangUpA11y: 'Raccrocher',
    },

    // Écran d'appel entrant — app/call/incoming/[id].tsx
    incoming: {
      fallbackName: 'Appel entrant',
      incomingVideo: 'Appel vidéo entrant',
      incomingAudio: 'Appel audio entrant',
      declineA11y: 'Refuser l’appel',
      acceptA11y: 'Accepter l’appel',
      declineHint: 'Tap pour refuser cet appel entrant',
      acceptHint: (callType: 'audio' | 'video') =>
        `Tap pour répondre à l’appel ${callType === 'video' ? 'vidéo' : 'audio'}`,
    },

    // Permissions micro/caméra — useCallPermissions.ts
    permissions: {
      deniedTitle: 'Permission refusée',
      deviceMic: 'micro',
      deviceCamera: 'caméra',
      deniedMessage: (device: string) =>
        `DOUMASSI a besoin d’accéder à ton ${device} pour passer cet appel. Active la permission dans les Réglages.`,
      openSettings: 'Ouvrir les Réglages',
    },
  },
};

export type MessagingTranslations = typeof messagingFr;
