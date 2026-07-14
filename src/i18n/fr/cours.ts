// Dictionnaire FRANÇAIS — namespace `cours` (E11-07 Apprendre).
// Tutoiement volontaire (cohérent avec le ton de l'app).
//
// Clés structurées par écran/composant. Les objets `resourceType`,
// `reportReason` et `reputation` sont keyés sur les valeurs d'enum métier
// (stockées en DB / renvoyées par les RPC) pour permettre un lookup direct
// `t.cours.resourceType[resource.type]` : on ne traduit pas l'enum, seulement
// son libellé UI.

export const coursFr = {
  // Libellés partagés entre plusieurs écrans.
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    error: 'Erreur',
    retry: 'Réessaie.',
    pullToRetry: 'Tire vers le bas pour réessayer.',
    notAuthenticated: 'Non authentifié',
  },

  // Icône signet (carte, fiche ressource).
  bookmark: {
    add: 'Ajouter aux favoris',
    remove: 'Retirer des favoris',
  },

  // Libellés de type de ressource (mappés sur l'enum `resource_type`).
  resourceType: {
    cours: 'Cours',
    fiche_revision: 'Fiche de révision',
    exercices: 'Exercices',
    annale: 'Annale',
  },

  // Raisons de signalement (mappées sur l'enum `report_reason`).
  reportReason: {
    inapproprie: 'Contenu inapproprié',
    fausse_info: 'Erreur ou fausse information',
    spam: 'Spam ou publicité',
    autre: 'Autre',
  },

  // Paliers de réputation auteur (mappés sur l'enum `reputation_tier`).
  reputation: {
    expert: 'Expert',
    confirme: 'Contributeur confirmé',
    contributeur: 'Contributeur',
  },

  // Écran bibliothèque « Apprendre » — app/cours/index.tsx
  library: {
    title: 'Apprendre',
    myFeedA11y: 'Mon fil',
    bookmarksA11y: 'Mes ressources sauvegardées',
    createA11y: 'Publier une ressource',
    searchPlaceholder: 'Rechercher un cours, une fiche…',
    searchA11y: 'Rechercher une ressource',
    clearSearchA11y: 'Effacer la recherche',
    allSubjects: 'Toutes matières',
    allLevels: 'Tous niveaux',
    allTypes: 'Tous types',
    follow: (label: string) => `Suivre ${label}`,
    unfollow: (label: string) => `Ne plus suivre ${label}`,
    following: (label: string) => `Suivi · ${label}`,
    errorTitle: 'Impossible de charger les ressources',
    emptyTitle: 'Aucune ressource trouvée',
    emptySearch: (query: string) => `Rien ne correspond à "${query}".`,
    emptyDefault: 'Sois le premier à partager un cours ici.',
  },

  // Écran Mon fil — app/cours/feed.tsx
  feed: {
    title: 'Mon fil',
    emptyTitle: 'Ton fil est vide',
    emptySubtitle:
      'Suis des matières depuis l’écran Apprendre pour voir leurs nouvelles ressources ici.',
    discoverCta: 'Découvrir des matières',
  },

  // Écran fiche ressource — app/cours/[id].tsx
  detail: {
    title: 'Ressource',
    notFoundTitle: 'Ressource introuvable',
    notFoundSubtitle: 'Elle a peut-être été supprimée ou masquée.',
    views: (n: number) => `${n} vue${n > 1 ? 's' : ''}`,
    descriptionLabel: 'Description',
    filesLabel: (n: number) => `Fichiers (${n})`,
    noFiles: 'Aucun fichier joint à cette ressource.',
    takeQuiz: 'Passer le quiz',
    takeQuizA11y: (title: string) => `Passer le quiz : ${title}`,
    questionCount: (n: number) => `${n} question${n > 1 ? 's' : ''}`,
    addQuiz: 'Ajouter un quiz à cette ressource',
    authorLabel: 'Auteur',
    viewProfileA11y: (username: string) => `Voir le profil de ${username}`,
    entraide: 'Entraide',
    commentCount: (n: number) => `${n} commentaire${n > 1 ? 's' : ''}`,
    entraideA11y: (n: number) => `Entraide, ${n} commentaire${n > 1 ? 's' : ''}`,
    report: 'Signaler cette ressource',
    ownResource: `C'est votre ressource`,
    contactAuthor: 'Contacter l’auteur',
    contactAuthorA11y: (username: string) => `Contacter ${username}`,
    contactPrefill: (title: string) => `Bonjour, j'ai une question sur ta ressource '${title}'.`,
    openFileErrorTitle: 'Impossible d’ouvrir le fichier',
    openFileErrorMessage: 'Réessaie dans un instant.',
    reportSuccessTitle: 'Merci',
    reportSuccessMessage: 'Ton signalement a bien été envoyé. Nous allons le vérifier.',
    reportErrorTitle: 'Signalement impossible',
    reportErrorFallback: 'Réessaie plus tard.',
    contactErrorTitle: 'Impossible de contacter l’auteur',
    contactErrorFallback: 'Réessaie plus tard.',
    // Date relative affichée sur la fiche (préfixée « il y a »).
    time: {
      today: "aujourd'hui",
      days: (n: number) => `il y a ${n} j`,
      weeks: (n: number) => `il y a ${n} sem`,
      months: (n: number) => `il y a ${n} mois`,
      years: (n: number) => `il y a ${n} an`,
    },
  },

  // Écran création de ressource — app/cours/create.tsx
  create: {
    title: 'Nouvelle ressource',
    optional: 'Optionnel',
    sections: {
      type: 'Type',
      level: 'Niveau',
      subject: 'Matière',
      title: 'Titre',
      description: 'Description',
      files: 'Fichiers',
    },
    titlePlaceholder: 'Ex : Cours complet sur les fonctions dérivées',
    titleA11y: 'Titre de la ressource',
    descriptionPlaceholder: 'Résume le contenu, le chapitre couvert, ce que l’élève va apprendre…',
    descriptionA11y: 'Description de la ressource',
    uploadProgress: (done: number, total: number) => `Upload des fichiers ${done}/${total}…`,
    submitCta: 'Publier',
    submitA11y: 'Publier la ressource',
    discardTitle: 'Abandonner cette ressource ?',
    discardMessage: 'Tu perdras ce que tu as saisi.',
    discardKeepEditing: 'Continuer la saisie',
    discardConfirm: 'Abandonner',
    submitErrorTitle: 'Publication impossible',
    submitErrorFallback: 'Une erreur est survenue, réessaie.',
    errors: {
      levelRequired: 'Choisis un niveau.',
      subjectRequired: 'Choisis une matière.',
      titleMin: 'Le titre doit faire au moins 3 caractères.',
      maxChars: (max: number) => `Maximum ${max} caractères.`,
      filesRequired: 'Ajoute au moins 1 fichier (PDF ou image).',
    },
  },

  // Écran éditeur de quiz — app/cours/quiz-create.tsx
  quizCreate: {
    title: 'Créer un quiz',
    titlePlaceholder: 'Titre du quiz',
    titleA11y: 'Titre du quiz',
    titlePrefix: (resourceTitle: string) => `Quiz — ${resourceTitle}`,
    importCta: 'J’ai déjà mes questions (importer depuis mon IA)',
    importA11y: 'Importer depuis ton IA',
    questionLabel: (n: number) => `Question ${n}`,
    deleteQuestionA11y: (n: number) => `Supprimer la question ${n}`,
    promptPlaceholder: 'Énoncé de la question',
    promptA11y: (n: number) => `Énoncé question ${n}`,
    optionPlaceholder: (n: number) => `Option ${n}`,
    optionLabelA11y: (n: number) => `Libellé option ${n}`,
    optionFallback: (n: number) => `option ${n}`,
    correctAnswerA11y: (label: string) => `Bonne réponse : ${label}`,
    removeOptionA11y: (n: number) => `Retirer l'option ${n}`,
    addOption: '+ Ajouter une option',
    addOptionA11y: 'Ajouter une option',
    addQuestion: 'Ajouter une question',
    submitCta: 'Publier le quiz',
    submitA11y: 'Publier le quiz',
    types: {
      single: 'Choix unique',
      multiple: 'Choix multiple',
      boolean: 'Vrai / Faux',
    },
    boolean: {
      true: 'Vrai',
      false: 'Faux',
    },
    discardTitle: 'Abandonner ce quiz ?',
    discardMessage: 'Tu perdras les questions saisies.',
    discardKeep: 'Continuer',
    discardConfirm: 'Abandonner',
    incompleteTitle: 'Quiz incomplet',
    missingTaxonomy: 'Niveau ou matière manquant.',
    submitErrorTitle: 'Publication impossible',
    validation: {
      titleMin: 'Donne un titre au quiz (3 caractères min).',
      noQuestions: 'Ajoute au moins 1 question.',
      promptMissing: (label: string) => `${label} : énoncé manquant.`,
      minOptions: (label: string) => `${label} : au moins 2 options.`,
      optionLabelMissing: (label: string) =>
        `${label} : toutes les options doivent avoir un libellé.`,
      correctMissing: (label: string) => `${label} : indique au moins une bonne réponse.`,
    },
  },

  // Bottom-sheet import de quiz depuis une IA — QuizImportSheet + lib/quizImport
  quizImport: {
    title: 'Importer depuis ton IA',
    step1: '1. Copie ce prompt, colle-le dans ton IA (ChatGPT, etc.) avec ton cours.',
    copyPrompt: 'Copier le prompt',
    copyPromptA11y: 'Copier le prompt',
    copied: 'Prompt copié !',
    step2: '2. Colle ici la réponse JSON de ton IA.',
    jsonA11y: 'Coller le JSON du quiz',
    importCta: 'Importer les questions',
    importA11y: 'Importer les questions',
    // Prompt copié dans le presse-papier, destiné à l'IA de l'utilisateur.
    prompt: `Génère un quiz à partir du cours ci-dessous.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte avant ou après, au format EXACT suivant :

[
  {
    "prompt": "énoncé de la question",
    "type": "single",
    "options": [
      { "label": "une réponse", "is_correct": true },
      { "label": "une autre réponse", "is_correct": false }
    ]
  }
]

Règles STRICTES :
- "type" vaut "single" (une seule bonne réponse) ou "multiple" (plusieurs bonnes réponses).
- Chaque question a entre 2 et 5 options.
- Au moins une option a "is_correct": true.
- Réponds en français.
- 5 à 10 questions.

Cours :
<<< COLLE TON COURS ICI >>>`,
    questionLabel: (n: number) => `Question ${n}`,
    errors: {
      empty: 'Le champ est vide. Colle le JSON généré par ton IA.',
      invalidJson:
        "Le texte n'est pas un JSON valide. Vérifie que tu as bien copié tout le tableau.",
      notArray: 'Le JSON doit être un tableau de questions.',
      noQuestions: 'Aucune question trouvée dans le JSON.',
      promptMissing: (label: string) => `${label} : énoncé ("prompt") manquant.`,
      minOptions: (label: string) => `${label} : il faut au moins 2 options.`,
      optionLabelMissing: (label: string, optionIndex: number) =>
        `${label}, option ${optionIndex} : libellé manquant.`,
      correctMissing: (label: string) => `${label} : indique au moins une bonne réponse.`,
    },
  },

  // Écran passer un quiz — app/cours/quiz/[id].tsx
  quizPlay: {
    fallbackTitle: 'Quiz',
    notFoundTitle: 'Quiz introuvable',
    scoreResult: (correct: number, total: number) => `${correct}/${total} bonnes réponses`,
    bestScore: (pct: number) => `Meilleur score : ${pct}%`,
    bestScoreShort: (pct: number) => `Meilleur : ${pct}%`,
    questionCount: (n: number) => `${n} question${n > 1 ? 's' : ''}`,
    multipleHint: 'Plusieurs réponses possibles',
    retryCta: 'Recommencer',
    retryA11y: 'Recommencer le quiz',
    submitCta: 'Valider',
    submitDisabled: 'Réponds à toutes les questions',
    submitA11y: 'Valider mes réponses',
  },

  // Écran favoris — app/cours/bookmarks.tsx
  bookmarks: {
    title: 'Mes ressources',
    errorTitle: 'Impossible de charger tes ressources',
    emptyTitle: 'Aucune ressource sauvegardée',
    emptySubtitle: 'Touche l’icône signet sur une ressource pour la retrouver ici.',
    exploreCta: 'Explorer les ressources',
  },

  // Écran entraide (commentaires) — app/cours/comments/[id].tsx
  comments: {
    title: 'Entraide',
    emptyTitle: 'Aucun commentaire',
    emptySubtitle: 'Pose une question ou partage une remarque sur cette ressource.',
    placeholder: 'Écrire un commentaire…',
    inputA11y: 'Écrire un commentaire',
    sendA11y: 'Envoyer',
    deleteA11y: 'Supprimer mon commentaire',
    deleteConfirmTitle: 'Supprimer ce commentaire ?',
    deleteCancel: 'Annuler',
    deleteConfirm: 'Supprimer',
    // Date relative des commentaires (format court, sans « il y a »).
    time: {
      justNow: "à l'instant",
      minutes: (n: number) => `${n} min`,
      hours: (n: number) => `${n} h`,
      days: (n: number) => `${n} j`,
      weeks: (n: number) => `${n} sem`,
    },
  },

  // Carte ressource dans les listes — ResourceCard
  card: {
    a11yLabel: (type: string, title: string, subject: string, level: string, author: string) =>
      `${type} : ${title}, ${subject} ${level}, par ${author}`,
  },

  // Ligne de fichier ouvrable — ResourceFileRow
  file: {
    image: 'Image',
    document: 'Document',
    item: (kind: string, index: number) => `${kind} ${index}`,
    openA11y: (label: string, ext: string) => `Ouvrir ${label} (${ext})`,
    defaultName: 'fichier',
    defaultExt: 'FICHIER',
  },

  // Sélecteur de fichiers — ResourceFilePicker
  filePicker: {
    fileFallback: (n: number) => `Fichier ${n}`,
    removeA11y: (name: string) => `Retirer ${name}`,
    removeFallback: (n: number) => `le fichier ${n}`,
    addA11y: (count: number, max: number) => `Ajouter un fichier (${count}/${max})`,
    addCta: (count: number, max: number) => `Ajouter un PDF ou une image (${count}/${max})`,
    pickErrorTitle: 'Sélection impossible',
    pickErrorMessage: 'Impossible d’ouvrir le sélecteur de fichiers.',
  },

  // Bottom-sheet de signalement — ReportReasonSheet
  reportSheet: {
    title: 'Signaler cette ressource',
    subtitle: 'Pourquoi signales-tu ce contenu ?',
  },
};

export type CoursTranslations = typeof coursFr;
