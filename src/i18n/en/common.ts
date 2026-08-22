// ENGLISH dictionary — `common` namespace (E11-09).
// Must cover exactly the same keys as fr/common.ts (typed as
// `CommonTranslations`, so a missing key is a TypeScript error).

import type { CommonTranslations } from '../fr/common';

export const commonEn: CommonTranslations = {
  tabs: {
    feed: 'Home',
    notifications: 'Notifications',
    studioAi: 'Doumassi AI',
    messages: 'Messages',
    profile: 'My profile',
  },
  a11y: {
    goBack: 'Go back',
    logo: 'DOUMASSI logo',
  },
  terms: {
    title: 'Terms & Conditions',
  },
  privacy: {
    title: 'Privacy Policy',
  },
  legal: {
    version: (v: string) => `Version ${v}`,
  },
  studioAi: {
    comingSoonTitle: 'Doumassi AI coming soon',
    comingSoonSubtitle: 'AI assistant, image generation and more.',
  },
};
