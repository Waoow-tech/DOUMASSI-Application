// ENGLISH dictionary — `cours` namespace (E11-07 Learn).
// Same keys as fr/cours.ts, natural English values.

import type { CoursTranslations } from '../fr/cours';

export const coursEn: CoursTranslations = {
  common: {
    back: 'Back',
    cancel: 'Cancel',
    error: 'Error',
    retry: 'Please try again.',
    pullToRetry: 'Pull down to try again.',
    notAuthenticated: 'Not authenticated',
  },

  bookmark: {
    add: 'Add to favorites',
    remove: 'Remove from favorites',
  },

  resourceType: {
    cours: 'Course',
    fiche_revision: 'Revision sheet',
    exercices: 'Exercises',
    annale: 'Past paper',
  },

  reportReason: {
    inapproprie: 'Inappropriate content',
    fausse_info: 'Error or false information',
    spam: 'Spam or advertising',
    autre: 'Other',
  },

  reputation: {
    expert: 'Expert',
    confirme: 'Established contributor',
    contributeur: 'Contributor',
  },

  library: {
    title: 'Learn',
    myFeedA11y: 'My feed',
    bookmarksA11y: 'My saved resources',
    createA11y: 'Publish a resource',
    searchPlaceholder: 'Search for a course, a sheet…',
    searchA11y: 'Search a resource',
    clearSearchA11y: 'Clear search',
    allSubjects: 'All subjects',
    allLevels: 'All levels',
    allTypes: 'All types',
    follow: (label: string) => `Follow ${label}`,
    unfollow: (label: string) => `Unfollow ${label}`,
    following: (label: string) => `Following · ${label}`,
    errorTitle: 'Could not load resources',
    emptyTitle: 'No resource found',
    emptySearch: (query: string) => `Nothing matches "${query}".`,
    emptyDefault: 'Be the first to share a course here.',
  },

  feed: {
    title: 'My feed',
    emptyTitle: 'Your feed is empty',
    emptySubtitle: 'Follow subjects from the Learn screen to see their new resources here.',
    discoverCta: 'Discover subjects',
  },

  detail: {
    title: 'Resource',
    notFoundTitle: 'Resource not found',
    notFoundSubtitle: 'It may have been deleted or hidden.',
    views: (n: number) => `${n} view${n === 1 ? '' : 's'}`,
    descriptionLabel: 'Description',
    filesLabel: (n: number) => `Files (${n})`,
    noFiles: 'No file attached to this resource.',
    takeQuiz: 'Take the quiz',
    takeQuizA11y: (title: string) => `Take the quiz: ${title}`,
    questionCount: (n: number) => `${n} question${n === 1 ? '' : 's'}`,
    addQuiz: 'Add a quiz to this resource',
    authorLabel: 'Author',
    viewProfileA11y: (username: string) => `View ${username}'s profile`,
    entraide: 'Help & discussion',
    commentCount: (n: number) => `${n} comment${n === 1 ? '' : 's'}`,
    entraideA11y: (n: number) => `Help & discussion, ${n} comment${n === 1 ? '' : 's'}`,
    report: 'Report this resource',
    ownResource: 'This is your resource',
    contactAuthor: 'Contact the author',
    contactAuthorA11y: (username: string) => `Contact ${username}`,
    contactPrefill: (title: string) => `Hi, I have a question about your resource '${title}'.`,
    openFileErrorTitle: 'Could not open the file',
    openFileErrorMessage: 'Please try again in a moment.',
    reportSuccessTitle: 'Thank you',
    reportSuccessMessage: 'Your report has been sent. We will review it.',
    reportErrorTitle: 'Could not report',
    reportErrorFallback: 'Please try again later.',
    contactErrorTitle: 'Could not contact the author',
    contactErrorFallback: 'Please try again later.',
    time: {
      today: 'today',
      days: (n: number) => `${n}d ago`,
      weeks: (n: number) => `${n}w ago`,
      months: (n: number) => `${n}mo ago`,
      years: (n: number) => `${n}y ago`,
    },
  },

  create: {
    title: 'New resource',
    optional: 'Optional',
    sections: {
      type: 'Type',
      level: 'Level',
      subject: 'Subject',
      title: 'Title',
      description: 'Description',
      files: 'Files',
    },
    titlePlaceholder: 'E.g. Complete course on derivatives',
    titleA11y: 'Resource title',
    descriptionPlaceholder:
      'Summarize the content, the chapter covered, what the student will learn…',
    descriptionA11y: 'Resource description',
    uploadProgress: (done: number, total: number) => `Uploading files ${done}/${total}…`,
    submitCta: 'Publish',
    submitA11y: 'Publish the resource',
    discardTitle: 'Discard this resource?',
    discardMessage: 'You will lose what you have entered.',
    discardKeepEditing: 'Keep editing',
    discardConfirm: 'Discard',
    submitErrorTitle: 'Could not publish',
    submitErrorFallback: 'Something went wrong, please try again.',
    errors: {
      levelRequired: 'Choose a level.',
      subjectRequired: 'Choose a subject.',
      titleMin: 'The title must be at least 3 characters.',
      maxChars: (max: number) => `Maximum ${max} characters.`,
      filesRequired: 'Add at least 1 file (PDF or image).',
    },
  },

  quizCreate: {
    title: 'Create a quiz',
    titlePlaceholder: 'Quiz title',
    titleA11y: 'Quiz title',
    titlePrefix: (resourceTitle: string) => `Quiz — ${resourceTitle}`,
    importCta: 'I already have my questions (import from my AI)',
    importA11y: 'Import from your AI',
    questionLabel: (n: number) => `Question ${n}`,
    deleteQuestionA11y: (n: number) => `Delete question ${n}`,
    promptPlaceholder: 'Question wording',
    promptA11y: (n: number) => `Wording of question ${n}`,
    optionPlaceholder: (n: number) => `Option ${n}`,
    optionLabelA11y: (n: number) => `Option ${n} label`,
    optionFallback: (n: number) => `option ${n}`,
    correctAnswerA11y: (label: string) => `Correct answer: ${label}`,
    removeOptionA11y: (n: number) => `Remove option ${n}`,
    addOption: '+ Add an option',
    addOptionA11y: 'Add an option',
    addQuestion: 'Add a question',
    submitCta: 'Publish the quiz',
    submitA11y: 'Publish the quiz',
    types: {
      single: 'Single choice',
      multiple: 'Multiple choice',
      boolean: 'True / False',
    },
    boolean: {
      true: 'True',
      false: 'False',
    },
    discardTitle: 'Discard this quiz?',
    discardMessage: 'You will lose the questions you entered.',
    discardKeep: 'Keep editing',
    discardConfirm: 'Discard',
    incompleteTitle: 'Incomplete quiz',
    missingTaxonomy: 'Level or subject missing.',
    submitErrorTitle: 'Could not publish',
    validation: {
      titleMin: 'Give the quiz a title (3 characters min).',
      noQuestions: 'Add at least 1 question.',
      promptMissing: (label: string) => `${label}: wording missing.`,
      minOptions: (label: string) => `${label}: at least 2 options.`,
      optionLabelMissing: (label: string) => `${label}: every option must have a label.`,
      correctMissing: (label: string) => `${label}: mark at least one correct answer.`,
    },
  },

  quizImport: {
    title: 'Import from your AI',
    step1: '1. Copy this prompt, paste it into your AI (ChatGPT, etc.) along with your course.',
    copyPrompt: 'Copy the prompt',
    copyPromptA11y: 'Copy the prompt',
    copied: 'Prompt copied!',
    step2: '2. Paste your AI’s JSON response here.',
    jsonA11y: 'Paste the quiz JSON',
    importCta: 'Import the questions',
    importA11y: 'Import the questions',
    prompt: `Generate a quiz from the course below.

Reply ONLY with a valid JSON array, with no text before or after, in the EXACT format below:

[
  {
    "prompt": "the question wording",
    "type": "single",
    "options": [
      { "label": "one answer", "is_correct": true },
      { "label": "another answer", "is_correct": false }
    ]
  }
]

STRICT rules:
- "type" is "single" (one correct answer) or "multiple" (several correct answers).
- Each question has between 2 and 5 options.
- At least one option has "is_correct": true.
- Reply in English.
- 5 to 10 questions.

Course:
<<< PASTE YOUR COURSE HERE >>>`,
    questionLabel: (n: number) => `Question ${n}`,
    errors: {
      empty: 'The field is empty. Paste the JSON generated by your AI.',
      invalidJson: 'The text is not valid JSON. Check that you copied the whole array.',
      notArray: 'The JSON must be an array of questions.',
      noQuestions: 'No question found in the JSON.',
      promptMissing: (label: string) => `${label}: wording ("prompt") missing.`,
      minOptions: (label: string) => `${label}: at least 2 options are required.`,
      optionLabelMissing: (label: string, optionIndex: number) =>
        `${label}, option ${optionIndex}: label missing.`,
      correctMissing: (label: string) => `${label}: mark at least one correct answer.`,
    },
  },

  quizPlay: {
    fallbackTitle: 'Quiz',
    notFoundTitle: 'Quiz not found',
    scoreResult: (correct: number, total: number) => `${correct}/${total} correct answers`,
    bestScore: (pct: number) => `Best score: ${pct}%`,
    bestScoreShort: (pct: number) => `Best: ${pct}%`,
    questionCount: (n: number) => `${n} question${n === 1 ? '' : 's'}`,
    multipleHint: 'Several answers possible',
    retryCta: 'Start over',
    retryA11y: 'Start the quiz over',
    submitCta: 'Submit',
    submitDisabled: 'Answer every question',
    submitA11y: 'Submit my answers',
  },

  bookmarks: {
    title: 'My resources',
    errorTitle: 'Could not load your resources',
    emptyTitle: 'No saved resource',
    emptySubtitle: 'Tap the bookmark icon on a resource to find it here.',
    exploreCta: 'Explore resources',
  },

  comments: {
    title: 'Help & discussion',
    emptyTitle: 'No comment yet',
    emptySubtitle: 'Ask a question or share a remark about this resource.',
    placeholder: 'Write a comment…',
    inputA11y: 'Write a comment',
    sendA11y: 'Send',
    deleteA11y: 'Delete my comment',
    deleteConfirmTitle: 'Delete this comment?',
    deleteCancel: 'Cancel',
    deleteConfirm: 'Delete',
    time: {
      justNow: 'just now',
      minutes: (n: number) => `${n} min`,
      hours: (n: number) => `${n} h`,
      days: (n: number) => `${n}d`,
      weeks: (n: number) => `${n}w`,
    },
  },

  card: {
    a11yLabel: (type: string, title: string, subject: string, level: string, author: string) =>
      `${type}: ${title}, ${subject} ${level}, by ${author}`,
  },

  file: {
    image: 'Image',
    document: 'Document',
    item: (kind: string, index: number) => `${kind} ${index}`,
    openA11y: (label: string, ext: string) => `Open ${label} (${ext})`,
    defaultName: 'file',
    defaultExt: 'FILE',
  },

  filePicker: {
    fileFallback: (n: number) => `File ${n}`,
    removeA11y: (name: string) => `Remove ${name}`,
    removeFallback: (n: number) => `file ${n}`,
    addA11y: (count: number, max: number) => `Add a file (${count}/${max})`,
    addCta: (count: number, max: number) => `Add a PDF or an image (${count}/${max})`,
    pickErrorTitle: 'Could not select',
    pickErrorMessage: 'Could not open the file picker.',
  },

  reportSheet: {
    title: 'Report this resource',
    subtitle: 'Why are you reporting this content?',
  },
};
