// Dictionnaire FRANÇAIS — namespace `matching` (E13).
// Tutoiement volontaire (cohérent avec le ton de l'app).
//
// Vocabulaire volontairement NON-AMOUREUX (ADR-008 §2.1) : on parle de « mise en
// relation », de « binôme », d'« entraide » — jamais de rencontre ni de match
// sentimental.

export const matchingFr = {
  title: 'Mise en relation',
  back: 'Retour',

  // Écran « Déclarer mon intention » (E13-05)
  intent: {
    title: 'Mes intentions',
    subtitle:
      'Dis ce que tu cherches ou ce que tu proposes — on te montrera les personnes qui correspondent.',

    optInLabel: 'Apparaître dans la mise en relation',
    optInHint:
      'Personne ne te voit tant que ce n’est pas activé. Tu peux le désactiver à tout moment sans perdre tes intentions.',

    domainLabel: 'Domaine',
    domain: {
      scolaire: 'Scolaire',
      business: 'Business',
    },

    directionLabel: 'Je…',
    direction: {
      cherche: 'Je cherche',
      propose: 'Je propose',
    },

    subjectLabel: 'Matière',
    levelLabel: 'Niveau',
    levelAny: 'Tous niveaux',

    tagsLabel: 'Compétences / secteurs',
    tagsPlaceholder: 'Ex : dev web, design, comptabilité',
    tagsHint: 'Sépare par des virgules.',

    noteLabel: 'Précision (optionnel)',
    notePlaceholder: 'Ex : dispo le week-end, niveau débutant…',

    add: 'Ajouter cette intention',
    adding: 'Ajout…',

    listTitle: 'Mes intentions actives',
    empty: 'Aucune intention pour l’instant. Ajoutes-en une pour être mis en relation.',
    delete: 'Supprimer',
    deleteConfirmTitle: 'Supprimer cette intention ?',
    deleteConfirmMessage: 'Tu n’apparaîtras plus dans les résultats pour celle-ci.',
    cancel: 'Annuler',

    errorTitle: 'Impossible d’enregistrer',
    errorSubjectRequired: 'Choisis une matière.',
    errorTagsRequired: 'Indique au moins une compétence.',
    errorGeneric: 'Une erreur est survenue. Réessaie.',
  },
};

export type MatchingTranslations = typeof matchingFr;
