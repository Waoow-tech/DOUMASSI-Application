// Dictionnaire FRANÇAIS — namespace `ai` (E5-03).
// Studio AI : écran de chat, bulles, saisie, erreurs.
// Tutoiement volontaire (cohérent avec le ton de l'app).

export const aiFr = {
  // En-tête de l'écran de chat — app/(tabs)/studio-ai.tsx
  header: {
    title: 'Doumassi AI',
    newChat: 'Nouvelle conversation',
    newChatA11y: 'Démarrer une nouvelle conversation',
  },

  // État vide (aucun message)
  empty: {
    title: 'Pose ta question',
    subtitle: 'Doumassi AI peut t’aider à réviser, écrire, comprendre… Lance-toi.',
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
