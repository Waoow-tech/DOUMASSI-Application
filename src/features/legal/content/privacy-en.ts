import type { LegalSection } from './cgv-fr';

export const PRIVACY_EN_TITLE = 'Privacy Policy (GDPR)';

export const PRIVACY_EN_UPDATED_AT = 'May 13, 2026';

export const privacyEnSections: LegalSection[] = [
  {
    title: '1. Data controller',
    body: [
      'DOUMASSI (D) acts as the data controller for ' +
        'personal data collected through the application.',
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
        'messages), payment information (handled by ' +
        'secure third-party providers), and technical ' +
        'data (IP address, device type, usage logs).',
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
        'and its technical subcontractors (hosting, ' +
        'payment).',
      'We never sell your personal data to third ' + 'parties.',
      'Public profile data is visible to other users ' + 'based on your privacy settings.',
    ],
  },
  {
    title: '6. International transfers',
    body: [
      'Some data may be transferred outside the ' +
        'European Economic Area (EEA). In such cases, ' +
        'we ensure an equivalent level of protection ' +
        'through European Commission standard ' +
        'contractual clauses or adequacy decisions.',
    ],
  },
  {
    title: '7. Data retention',
    body: [
      'We retain your data for as long as your ' + 'account is active.',
      'Upon account deletion, data is erased or ' +
        'anonymized within 30 days, unless longer ' +
        'retention is required by law (e.g., billing ' +
        'data for 10 years).',
    ],
  },
  {
    title: '8. Cookies and trackers',
    body: [
      'The application uses essential technical ' + 'trackers required for operation.',
      'Optional trackers (analytics, personalized ' +
        'advertising) may be used with your consent, ' +
        'which you can withdraw at any time in the ' +
        'settings.',
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
        'organizational measures (encryption, access ' +
        'controls) to protect your data against ' +
        'unauthorized access, loss, or alteration.',
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
