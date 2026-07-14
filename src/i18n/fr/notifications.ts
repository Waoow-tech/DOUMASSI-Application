// Dictionnaire FRANÇAIS — namespace `notifications` (E11-05).
// Écran Notifications + lignes de notif + demandes de suivi + états vides.
// Tutoiement (cohérent avec le ton de l'app).
// Les libellés dynamiques sont des fonctions (mêmes signatures côté EN).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel).

export const notificationsFr = {
  // En-tête d'écran + libellés transverses de l'écran Notifications.
  screen: {
    title: 'Notifications',
    filterA11y: (label: string) => `Filtre ${label}`,
    followRequestsHeader: (count: number) => `Demandes de suivis (${count})`,
  },

  // Onglets de filtres (les clés matchent les valeurs de NotificationFilter).
  filters: {
    all: 'Toutes',
    unread: 'Non lus',
    social: 'Social',
    payment: 'Paiement',
    ai: 'IA',
  },

  // En-têtes de groupes par période (affichés en capitales).
  periods: {
    week: 'CETTE SEMAINE',
    month: 'CE MOIS',
    older: 'PLUS ANCIEN',
  },

  // États vides — un par onglet (title + subtitle optionnel).
  empty: {
    unreadTitle: 'Aucune notification non lue',
    socialTitle: 'Pas d’activité sociale récente',
    paymentTitle: 'Pas de transaction récente',
    aiTitle: 'Pas de news IA pour l’instant',
    defaultTitle: 'Tu es à jour',
    defaultSubtitle: 'Les likes et commentaires apparaîtront ici bientôt.',
  },

  // Notif système mock injectée sur l'onglet IA pour la démo.
  mock: {
    welcomeTitle: 'Bienvenue sur l’app',
  },

  // Libellés d'une ligne de notif (NotificationRow) — la plupart dynamiques.
  row: {
    unknownUser: 'Un utilisateur',
    startedFollowingYou: (handle: string) => `${handle} a commencé à te suivre`,
    likedYourPost: (handle: string) => `${handle} a aimé ton post`,
    commentedWithPreview: (handle: string, preview: string) =>
      `${handle} a commenté ton post : « ${preview} »`,
    commentedYourPost: (handle: string) => `${handle} a commenté ton post`,
    mentionedYou: (handle: string) => `${handle} t’a mentionné dans son post`,
    systemNewsTitleFallback: 'Doumassi AI news',
    systemNews: (title: string) => `Doumassi AI news : ${title}`,
    paymentUnknownSender: 'un utilisateur',
    paymentWithAmount: (from: string, amount: string) => `Paiement accepté de ${from} : ${amount}`,
    paymentAccepted: (from: string) => `Paiement accepté de ${from}`,
    wantsToFollowYou: (handle: string) => `${handle} veut te suivre`,

    // Âge relatif d'une notif.
    time: {
      now: 'à l’instant',
      minutes: (n: number) => `${n}min`,
      hours: (n: number) => `${n}h`,
      days: (n: number) => `${n}j`,
      weeks: (n: number) => `${n}sem`,
    },
  },

  // Carte « Demande de suivi » (FollowRequestCard).
  followRequest: {
    unknownUser: 'inconnu',
    wantsToFollowYou: 'veut te suivre',
    confirm: 'Confirmer',
    reject: 'Refuser',
  },
};

export type NotificationsTranslations = typeof notificationsFr;
