// Dictionnaire FRANÇAIS — namespace `common` (E11-09 Partagés & divers).
// Regroupe le chrome des écrans légaux (CGU/confidentialité), les libellés
// d'accessibilité de la tab bar, l'écran Studio AI (placeholder) et les
// libellés vraiment transverses.
// Tutoiement volontaire (cohérent avec le ton de l'app).
// ⚠️ PAS de `as const` : on veut des valeurs typées `string` (structurel), sinon
// chaque valeur FR deviendrait un type littéral que l'anglais ne pourrait matcher.

export const commonFr = {
  // Libellés d'accessibilité de la tab bar. `tabBarShowLabel` est à false donc
  // ces textes ne sont lus que par les lecteurs d'écran.
  tabs: {
    feed: 'Accueil',
    notifications: 'Notifications',
    studioAi: 'Doumassi AI',
    messages: 'Messages',
    profile: 'Mon profil',
  },
  // Libellés d'accessibilité transverses (boutons de navigation, logo).
  a11y: {
    goBack: 'Retour',
    logo: 'Logo DOUMASSI',
  },
  // En-tête (barre du haut) des écrans légaux.
  terms: {
    title: 'Conditions générales',
  },
  privacy: {
    title: 'Politique de confidentialité',
  },
  // Libellés partagés par les écrans légaux.
  legal: {
    version: (v: string) => `Version ${v}`,
  },
  // Écran Studio AI — placeholder (vrai écran livré en Sprint 5-6).
  studioAi: {
    comingSoonTitle: 'Doumassi AI bientôt disponible',
    comingSoonSubtitle: 'Assistant IA, génération d’images et plus.',
  },
};

export type CommonTranslations = typeof commonFr;
