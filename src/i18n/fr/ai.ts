// Dictionnaire FRANÇAIS — namespace `ai` (E5-03).
// Studio AI : écran de chat, bulles, saisie, erreurs.
// Tutoiement volontaire (cohérent avec le ton de l'app).

export const aiFr = {
  // En-tête de l'écran de chat — app/(tabs)/studio-ai.tsx
  header: {
    title: 'Doumassi AI',
    newChat: 'Nouvelle conversation',
    newChatA11y: 'Démarrer une nouvelle conversation',
    historyA11y: 'Ouvrir l’historique des conversations',
  },

  // Drawer latéral de l'historique — AiConversationsDrawer.tsx (E5-04)
  drawer: {
    title: 'Conversations',
    newChat: 'Nouvelle conversation',
    empty: 'Aucune conversation pour l’instant.',
    untitled: 'Conversation',
    messageCount: (n: number) => `${n} message${n > 1 ? 's' : ''}`,
    closeA11y: 'Fermer l’historique',
    deleteA11y: 'Supprimer la conversation',
    deleteTitle: 'Supprimer la conversation ?',
    deleteMessage: 'Cette conversation et tous ses messages seront définitivement supprimés.',
    cancel: 'Annuler',
    delete: 'Supprimer',
  },

  // État vide (aucun message)
  empty: {
    title: 'Pose ta question',
    subtitle: 'Doumassi AI peut t’aider à réviser, écrire, comprendre… Lance-toi.',
  },

  // Menu « + » de la barre de saisie — E5-10
  menu: {
    title: 'Actions',
    addPhoto: 'Ajouter une photo',
    history: 'Historique',
    learning: 'Learning',
    openA11y: 'Ouvrir le menu des actions',
  },

  // Pièces jointes image — E5-06
  attach: {
    permissionTitle: 'Permission refusée',
    permissionMessage: 'Active l’accès aux photos dans les Réglages pour joindre une image.',
    removeA11y: 'Retirer la photo',
    tooMany: (max: number) => `${max} photos maximum par message.`,
    uploadFailed: 'Échec de l’envoi de la photo. Réessaie.',
  },

  // Mode Learning — E5-08
  learning: {
    badge: 'Mode Learning activé',
    hint: 'Doumassi AI te guide pas à pas au lieu de donner la réponse.',
    exit: 'Quitter',
    enableA11y: 'Activer le mode Learning (tuteur)',
    disableA11y: 'Désactiver le mode Learning',
  },

  // Suggestions de démarrage (tapées pour préremplir la saisie)
  suggestions: {
    explain: 'Explique-moi un concept',
    summarize: 'Résume un texte',
    ideas: 'Donne-moi des idées',
  },

  // Barre de saisie
  input: {
    placeholder: 'Écris ton message…',
    sendA11y: 'Envoyer le message',
    stopA11y: 'Arrêter la génération',
  },

  // Bulle assistant
  bubble: {
    typing: 'Doumassi AI écrit…',
    assistantLabel: 'Doumassi AI',
  },

  // Erreurs (mappées depuis AiChatError.kind)
  errors: {
    quota: (quota: number) =>
      `Tu as atteint ta limite de ${quota} messages pour aujourd’hui. Reviens demain.`,
    auth: 'Ta session a expiré. Reconnecte-toi.',
    provider: 'L’assistant est momentanément indisponible. Réessaie dans un instant.',
    network: 'Connexion impossible. Vérifie ta connexion et réessaie.',
    generic: 'Une erreur est survenue. Réessaie.',
    retry: 'Réessayer',
  },
};

export type AiTranslations = typeof aiFr;
