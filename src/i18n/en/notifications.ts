// ENGLISH dictionary — `notifications` namespace (E11-05).
// Must cover exactly the same keys as fr/notifications.ts (typed as
// `NotificationsTranslations`, so a missing/mismatched key is a TypeScript error).

import type { NotificationsTranslations } from '../fr/notifications';

export const notificationsEn: NotificationsTranslations = {
  screen: {
    title: 'Notifications',
    filterA11y: (label: string) => `${label} filter`,
    followRequestsHeader: (count: number) => `Follow requests (${count})`,
  },

  filters: {
    all: 'All',
    unread: 'Unread',
    social: 'Social',
    payment: 'Payment',
    ai: 'AI',
  },

  periods: {
    week: 'THIS WEEK',
    month: 'THIS MONTH',
    older: 'OLDER',
  },

  empty: {
    unreadTitle: 'No unread notifications',
    socialTitle: 'No recent social activity',
    paymentTitle: 'No recent transactions',
    aiTitle: 'No AI news for now',
    defaultTitle: 'You’re all caught up',
    defaultSubtitle: 'Likes and comments will show up here soon.',
  },

  mock: {
    welcomeTitle: 'Welcome to the app',
  },

  row: {
    unknownUser: 'A user',
    startedFollowingYou: (handle: string) => `${handle} started following you`,
    likedYourPost: (handle: string) => `${handle} liked your post`,
    commentedWithPreview: (handle: string, preview: string) =>
      `${handle} commented on your post: “${preview}”`,
    commentedYourPost: (handle: string) => `${handle} commented on your post`,
    mentionedYou: (handle: string) => `${handle} mentioned you in their post`,
    systemNewsTitleFallback: 'Doumassi AI news',
    systemNews: (title: string) => `Doumassi AI news: ${title}`,
    paymentUnknownSender: 'a user',
    paymentWithAmount: (from: string, amount: string) => `Payment received from ${from}: ${amount}`,
    paymentAccepted: (from: string) => `Payment received from ${from}`,
    wantsToFollowYou: (handle: string) => `${handle} wants to follow you`,

    time: {
      now: 'just now',
      minutes: (n: number) => `${n}min`,
      hours: (n: number) => `${n}h`,
      days: (n: number) => `${n}d`,
      weeks: (n: number) => `${n}w`,
    },
  },

  followRequest: {
    unknownUser: 'unknown',
    wantsToFollowYou: 'wants to follow you',
    confirm: 'Confirm',
    reject: 'Decline',
  },
};
