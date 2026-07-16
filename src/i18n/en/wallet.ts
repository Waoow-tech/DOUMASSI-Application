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

  send: {
    cta: 'Send',
    title: 'Send Dcoins',
    searchPlaceholder: 'Search for a user',
    searchHint: 'Type at least 2 characters to search.',
    noResults: 'No user found.',
    recipientLabel: 'Recipient',
    change: 'Change',
    amountLabel: 'Amount',
    available: (n: number) => `Available balance: ${n} Dcoins`,
    submit: 'Send',
    sending: 'Sending…',
    successTitle: 'Sent!',
    successMessage: (amount: number, username: string) => `${amount} Dcoins sent to @${username}.`,
    errorTitle: 'Could not send',
    errors: {
      insufficient: 'Insufficient balance.',
      self: 'You cannot send Dcoins to yourself.',
      recipientNotFound: 'Recipient not found.',
      invalidAmount: 'Enter a valid amount (greater than 0).',
      generic: 'Something went wrong. Please try again.',
    },
  },

  tip: {
    cta: 'Send a tip',
    title: 'Send a tip',
    successTitle: 'Thank you!',
    successMessage: (amount: number, username: string) => `${amount} Dcoins sent to @${username}.`,
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
