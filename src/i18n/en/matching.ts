// ENGLISH dictionary — `matching` namespace (E13).
// Must mirror exactly the keys of ../fr/matching (TypeScript enforces it).
//
// Deliberately NON-ROMANTIC wording (ADR-008 §2.1).

import type { MatchingTranslations } from '../fr/matching';

export const matchingEn: MatchingTranslations = {
  title: 'Connect',
  back: 'Back',

  intent: {
    title: 'My intents',
    subtitle: 'Say what you are looking for or offering — we’ll show you people who match.',

    optInLabel: 'Appear in Connect',
    optInHint:
      'Nobody sees you until this is on. You can turn it off anytime without losing your intents.',

    domainLabel: 'Area',
    domain: {
      scolaire: 'School',
      business: 'Business',
    },

    directionLabel: 'I…',
    direction: {
      cherche: 'I’m looking for',
      propose: 'I’m offering',
    },

    subjectLabel: 'Subject',
    levelLabel: 'Level',
    levelAny: 'Any level',

    tagsLabel: 'Skills / sectors',
    tagsPlaceholder: 'e.g. web dev, design, accounting',
    tagsHint: 'Separate with commas.',

    noteLabel: 'Details (optional)',
    notePlaceholder: 'e.g. available on weekends, beginner level…',

    add: 'Add this intent',
    adding: 'Adding…',

    listTitle: 'My active intents',
    empty: 'No intent yet. Add one to get connected.',
    delete: 'Delete',
    deleteConfirmTitle: 'Delete this intent?',
    deleteConfirmMessage: 'You will no longer appear in results for it.',
    cancel: 'Cancel',

    errorTitle: 'Could not save',
    errorSubjectRequired: 'Pick a subject.',
    errorTagsRequired: 'Enter at least one skill.',
    errorGeneric: 'Something went wrong. Please try again.',
  },
};
