// Dictionnaire FRANÇAIS — namespace `wallet` (E12-04).
// Tutoiement volontaire (cohérent avec le ton de l'app).
//
// `txType` est keyé sur l'enum DB `wallet_transaction_type` : on ne traduit PAS
// l'enum métier, seulement son libellé UI (lookup direct t.wallet.txType[tx.type]).

export const walletFr = {
  title: 'Portefeuille',
  back: 'Retour',

  balanceLabel: 'Solde',
  /** Unité de la monnaie interne (voir ADR-005). Non traduit : c'est un nom propre. */
  unit: 'Dcoins',

  historyTitle: 'Historique',

  /** Toast de gain (E12-08). */
  rewardToast: (amount: number) => `+${amount} Dcoins gagnés !`,

  empty: {
    title: 'Aucune transaction',
    subtitle: 'Tes mouvements de Dcoins apparaîtront ici.',
  },

  error: {
    title: 'Impossible de charger ton portefeuille.',
    retry: 'Réessayer',
  },

  // Flow d'envoi de Dcoins (E12-05).
  send: {
    /** Bouton d'entrée depuis l'écran Portefeuille. */
    cta: 'Envoyer',
    title: 'Envoyer des Dcoins',
    searchPlaceholder: 'Rechercher un utilisateur',
    searchHint: 'Tape au moins 2 caractères pour chercher.',
    noResults: 'Aucun utilisateur trouvé.',
    recipientLabel: 'Destinataire',
    change: 'Changer',
    amountLabel: 'Montant',
    available: (n: number) => `Solde disponible : ${n} Dcoins`,
    submit: 'Envoyer',
    sending: 'Envoi…',
    successTitle: 'Envoyé !',
    successMessage: (amount: number, username: string) =>
      `${amount} Dcoins envoyés à @${username}.`,
    errorTitle: 'Envoi impossible',
    errors: {
      insufficient: 'Solde insuffisant.',
      self: 'Tu ne peux pas t’envoyer des Dcoins à toi-même.',
      recipientNotFound: 'Destinataire introuvable.',
      invalidAmount: 'Entre un montant valide (supérieur à 0).',
      generic: 'Une erreur est survenue. Réessaie.',
    },
  },

  // Pourboires créateurs (E12-06). Réutilise le flow d'envoi (send.*) en mode tip.
  tip: {
    /** Bouton depuis la carte auteur d'un cours. */
    cta: 'Offrir un pourboire',
    title: 'Offrir un pourboire',
    successTitle: 'Merci !',
    successMessage: (amount: number, username: string) =>
      `${amount} Dcoins offerts à @${username}.`,
  },

  // Libellés des types de transaction (enum DB).
  txType: {
    grant: 'Crédit offert',
    reward: 'Récompense',
    topup: 'Rechargement',
    transfer_in: 'Reçu',
    transfer_out: 'Envoyé',
    tip_in: 'Pourboire reçu',
    tip_out: 'Pourboire envoyé',
    purchase: 'Dépense',
    refund: 'Remboursement',
    adjustment: 'Ajustement',
  },
};

export type WalletTranslations = typeof walletFr;
