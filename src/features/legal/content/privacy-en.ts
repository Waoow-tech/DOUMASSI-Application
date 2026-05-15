import type { LegalSection } from './cgv-fr';

export const PRIVACY_EN_TITLE = 'Privacy Policy (GDPR)';

export const PRIVACY_EN_UPDATED_AT = 'May 13, 2026';

export const privacyEnSections: LegalSection[] = [
  {
    title: '1. Data controller',
    body: [
      'DOUMASSI (D) acts as the data controller for ' +
        'personal data collected through the application ' +
        '(Contact: contact@doumassi.com).',
      'We are committed to protecting your privacy in ' +
        'accordance with the General Data Protection ' +
        'Regulation (GDPR) and applicable local laws.',
    ],
  },
  {
    title: '2. Data collected',
    body: [
      'We collect the following categories of data: ' +
        'identification information (name, email, date ' +
        'of birth), profile data (username, avatar, bio' +
        '), published content (posts, comments, ' +
        'messages), AI interactions, payment information ' +
        '(handled by secure third-party providers), and ' +
        'technical data (IP address, device type, usage ' +
        'logs).',
    ],
  },
  {
    title: '3. Purposes of processing',
    body: [
      'Your data is processed for: providing and ' +
        'managing your account, personalizing content ' +
        'through artificial intelligence, operating the ' +
        'marketplace, security and fraud prevention, ' +
        'technical improvement of the application, and ' +
        'compliance with our legal obligations.',
    ],
  },
  {
    title: '4. Legal basis',
    body: [
      'Processing is based on: performance of the ' +
        'contract (Terms and Conditions), your specific ' +
        'consent (for certain AI uses or optional ' +
        "cookies), DOUMASSI's legitimate interests " +
        '(security, improvement), and compliance with ' +
        'legal obligations.',
    ],
  },
  {
    title: '5. Data recipients',
    body: [
      'Your data is shared exclusively with DOUMASSI ' +
        'and its technical subcontractors (e.g., ' +
        'Supabase, OpenAI, Mistral, Tavily, Stripe).',
      'We never sell your personal data to third ' + 'parties.',
      'Public profile data is visible to other users ' + 'based on your privacy settings.',
    ],
  },
  {
    title: '6. International transfers',
    body: [
      'Some data may be transferred outside the ' +
        'European Economic Area (EEA), notably to the ' +
        'USA for OpenAI. In such cases, we ensure an ' +
        'equivalent level of protection through European ' +
        'Commission standard contractual clauses or ' +
        'adequacy decisions.',
    ],
  },
  {
    title: '7. Data retention',
    body: [
      'We retain your data for as long as your ' + 'account is active.',
      'Upon account deletion, data is erased or ' +
        'anonymized within 30 days after the request, ' +
        'unless longer retention is required by law ' +
        '(e.g., billing data for 10 years).',
    ],
  },
  {
    title: '8. Cookies and trackers',
    body: [
      'The application uses essential technical ' +
        'trackers required for operation (expo-secure-store).',
      'Optional trackers for analytics and error ' +
        'tracking (Sentry, PostHog) may be used with ' +
        'your consent, which you can withdraw at any ' +
        'time in the settings.',
    ],
  },
  {
    title: '9. Your rights',
    body: [
      'Under the GDPR, you have the following rights: ' +
        'access, rectification, erasure, objection, ' +
        'restriction of processing, and data ' +
        'portability.',
      'You can exercise these rights through the ' +
        'application settings or by contacting ' +
        'privacy@doumassi.com.',
      'You also have the right to lodge a complaint ' +
        'with the CNIL (or your local data protection ' +
        'authority).',
    ],
  },
  {
    title: '10. Minors',
    body: [
      'DOUMASSI is not intended for children under ' +
        '13 years of age without parental supervision.',
      'If we discover that we have collected data from ' +
        'a minor without parental consent, we will ' +
        'delete it immediately.',
    ],
  },
  {
    title: '11. Security',
    body: [
      'We implement rigorous technical and ' +
        'organizational measures (encryption, RLS, OAuth ' +
        'authentication, and future MFA) to protect ' +
        'your data against unauthorized access, loss, or ' +
        'alteration.',
    ],
  },
  {
    title: '12. Changes and contact',
    body: [
      'This policy may be updated. We will notify you ' + 'of any significant changes.',
      'For any questions: privacy@doumassi.com.',
    ],
  },
];
