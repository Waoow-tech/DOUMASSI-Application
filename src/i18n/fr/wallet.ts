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

  empty: {
    title: 'Aucune transaction',
    subtitle: 'Tes mouvements de Dcoins apparaîtront ici.',
  },

  error: {
    title: 'Impossible de charger ton portefeuille.',
    retry: 'Réessayer',
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
