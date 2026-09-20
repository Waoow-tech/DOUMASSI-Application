// ENGLISH dictionary — `contact` namespace (E8-03).
// Same keys as fr/contact.ts (typed as ContactTranslations).

import type { ContactTranslations } from '../fr/contact';

export const contactEn: ContactTranslations = {
  title: 'Contact us',
  subtitle: 'A question, a bug, an idea? Drop us a line — we reply fast.',

  nameLabel: 'Name',
  namePlaceholder: 'Your name',
  emailLabel: 'Email',
  emailPlaceholder: 'you@email.com',
  phoneLabel: 'Phone (optional)',
  phonePlaceholder: '+1 555 123 4567',
  companyLabel: 'Company (optional)',
  companyPlaceholder: 'Your organization',
  subjectLabel: 'Subject',
  subjectPlaceholder: 'What is it about?',
  messageLabel: 'Message',
  messagePlaceholder: 'Tell us in a few words…',

  submit: 'Send',
  successToast: 'Message sent! We’ll get back to you shortly.',

  validation: {
    nameRequired: 'Please enter your name.',
    emailRequired: 'Please enter your email.',
    invalidEmail: 'Invalid email address.',
    subjectRequired: 'Please enter a subject.',
    messageRequired: 'Please write your message.',
    messageTooShort: 'Your message is a bit short (10 characters minimum).',
  },

  errors: {
    rateLimited: 'You’ve already sent several messages. Please try again in an hour.',
    failed: 'Sending failed. Please try again in a moment.',
  },
};
