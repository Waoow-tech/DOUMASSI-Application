// ENGLISH dictionary — `wallet` namespace (E12-04).
// Must mirror exactly the keys of ../fr/wallet (TypeScript enforces it).

import type { WalletTranslations } from '../fr/wallet';

export const walletEn: WalletTranslations = {
  title: 'Wallet',
  back: 'Back',

  balanceLabel: 'Balance',
  unit: 'Dcoins',

  historyTitle: 'History',

  empty: {
    title: 'No transactions yet',
    subtitle: 'Your Dcoins activity will show up here.',
  },

  error: {
    title: 'Could not load your wallet.',
    retry: 'Retry',
  },

  txType: {
    grant: 'Credit granted',
    reward: 'Reward',
    topup: 'Top-up',
    transfer_in: 'Received',
    transfer_out: 'Sent',
    tip_in: 'Tip received',
    tip_out: 'Tip sent',
    purchase: 'Spent',
    refund: 'Refund',
    adjustment: 'Adjustment',
  },
};
