// Dictionnaire FRANÇAIS — namespace `contact` (E8-03).
// Formulaire de contact accessible depuis Réglages → Aide → Nous contacter.
// Tutoiement volontaire (cohérent avec le ton de l'app).

export const contactFr = {
  title: 'Nous contacter',
  subtitle: 'Une question, un bug, une idée ? Écris-nous, on te répond vite.',

  nameLabel: 'Nom',
  namePlaceholder: 'Ton nom',
  emailLabel: 'E-mail',
  emailPlaceholder: 'ton@email.com',
  phoneLabel: 'Téléphone (optionnel)',
  phonePlaceholder: '+33 6 12 34 56 78',
  companyLabel: 'Entreprise (optionnel)',
  companyPlaceholder: 'Ton organisation',
  subjectLabel: 'Sujet',
  subjectPlaceholder: 'De quoi s’agit-il ?',
  messageLabel: 'Message',
  messagePlaceholder: 'Explique-nous en quelques mots…',

  submit: 'Envoyer',
  successToast: 'Message envoyé ! On te répond très vite.',

  validation: {
    nameRequired: 'Indique ton nom.',
    emailRequired: 'Indique ton e-mail.',
    invalidEmail: 'Adresse e-mail invalide.',
    subjectRequired: 'Indique un sujet.',
    messageRequired: 'Écris ton message.',
    messageTooShort: 'Ton message est un peu court (10 caractères minimum).',
  },

  errors: {
    rateLimited: 'Tu as déjà envoyé plusieurs messages. Réessaie dans une heure.',
    failed: 'L’envoi a échoué. Réessaie dans un instant.',
  },
};

export type ContactTranslations = typeof contactFr;
