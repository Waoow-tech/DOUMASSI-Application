export type LegalSection = {
  title: string;
  body: string[];
};

export const CGV_FR_TITLE =
  "Conditions generales d'utilisation (CGU) et Conditions generales de vente (CGV)";

export const CGV_FR_UPDATED_AT = '11 mai 2026';

export const cgvFrSections: LegalSection[] = [
  {
    title: '1. Informations generales',
    body: [
      "Les presentes Conditions Generales d'Utilisation (CGU) et Conditions Generales de Vente (CGV) regissent l'acces et l'utilisation de l'application DOUMASSI (D, la Plateforme, l'Application), ainsi que les services associes.",
      "DOUMASSI est une plateforme numerique multifonctions integrant notamment : un reseau social, des fonctionnalites communautaires, des outils d'intelligence artificielle, une marketplace, des services de paiement, des contenus numeriques, des services cloud et logiciels, et des fonctionnalites de communication.",
      "En accedant a l'Application ou en utilisant ses services, l'utilisateur accepte pleinement et sans reserve les presentes conditions.",
    ],
  },
  {
    title: '2. Definitions',
    body: [
      "Application designe la plateforme DOUMASSI (D). Utilisateur designe toute personne physique ou morale utilisant l'Application. Compte designe l'espace personnel cree par l'Utilisateur. Contenu designe tout texte, image, video, audio, publication, commentaire, message ou donnee publie sur la plateforme. Services designe l'ensemble des fonctionnalites proposees par DOUMASSI. Marketplace designe l'espace de vente de produits ou services. IA designe les fonctionnalites d'intelligence artificielle integrees a la plateforme.",
    ],
  },
  {
    title: '3. Acceptation des conditions',
    body: [
      "L'utilisation de l'Application implique l'acceptation complete des presentes CGU/CGV.",
      "Si l'Utilisateur n'accepte pas ces conditions, il ne doit pas utiliser l'Application.",
      'DOUMASSI se reserve le droit de modifier les presentes conditions a tout moment. Les modifications prennent effet des leur publication sur la plateforme.',
    ],
  },
  {
    title: "4. Conditions d'acces",
    body: [
      "L'acces a certains services necessite la creation d'un compte.",
      "L'Utilisateur s'engage a fournir des informations exactes, maintenir la confidentialite de ses identifiants, ne pas usurper l'identite d'un tiers et utiliser l'Application conformement aux lois applicables.",
      'DOUMASSI peut suspendre ou supprimer un compte en cas de violation des presentes conditions.',
    ],
  },
  {
    title: '5. Age minimum',
    body: [
      "L'utilisation de l'Application est reservee aux personnes agees d'au moins 13 ans ou de l'age minimum requis dans le pays de residence de l'Utilisateur.",
      "Les mineurs doivent utiliser l'Application sous la supervision d'un representant legal.",
    ],
  },
  {
    title: '6. Utilisation autorisee',
    body: [
      "L'Utilisateur s'engage a ne pas publier de contenus illegaux, diffuser des contenus haineux, discriminatoires ou violents, harceler d'autres utilisateurs, publier des contenus pornographiques ou contraires aux bonnes moeurs, transmettre des virus ou logiciels malveillants, utiliser des robots, scripts ou systemes automatises non autorises, collecter illegalement des donnees, porter atteinte aux droits de propriete intellectuelle ou contourner les mesures de securite de la plateforme.",
      'DOUMASSI se reserve le droit de supprimer tout contenu non conforme.',
    ],
  },
  {
    title: '7. Contenus publies par les utilisateurs',
    body: [
      "L'Utilisateur reste proprietaire des contenus qu'il publie.",
      "En publiant du contenu sur DOUMASSI, l'Utilisateur accorde a DOUMASSI une licence mondiale, non exclusive, gratuite et transferable permettant l'hebergement, la reproduction, la diffusion, l'adaptation, la distribution, l'affichage et l'utilisation technique necessaire au fonctionnement de la plateforme.",
      "Cette licence prend fin lors de la suppression du contenu, sauf obligations legales contraires. L'Utilisateur garantit disposer de tous les droits necessaires sur les contenus publies.",
    ],
  },
  {
    title: '8. Moderation',
    body: [
      'DOUMASSI peut supprimer des contenus, limiter certaines fonctionnalites, suspendre temporairement un compte ou supprimer definitivement un compte.',
      'Les decisions de moderation peuvent etre prises automatiquement ou manuellement.',
    ],
  },
  {
    title: "9. Services d'intelligence artificielle",
    body: [
      "Certaines fonctionnalites de l'Application utilisent des systemes d'intelligence artificielle.",
      "Les resultats generes par l'IA sont fournis a titre informatif. DOUMASSI ne garantit pas l'exactitude absolue des resultats, l'absence d'erreurs, l'absence de biais ou l'adequation a un usage specifique.",
      "L'Utilisateur reste seul responsable de l'utilisation des contenus generes.",
    ],
  },
  {
    title: '10. Marketplace',
    body: [
      "La plateforme peut permettre l'achat, la vente ou la promotion de produits et services.",
      'Les vendeurs sont seuls responsables des produits proposes, des descriptions, des garanties legales et du respect des lois applicables.',
      "DOUMASSI agit en qualite d'intermediaire technique sauf mention contraire.",
    ],
  },
  {
    title: '11. Paiements',
    body: [
      'Certains services peuvent etre payants. Les prix sont affiches dans la devise applicable et peuvent inclure les taxes legales.',
      "L'Utilisateur autorise DOUMASSI ou ses prestataires de paiement a debiter le moyen de paiement enregistre.",
      'DOUMASSI peut utiliser des prestataires tiers securises pour le traitement des paiements.',
    ],
  },
  {
    title: '12. Abonnements',
    body: [
      "Certains services fonctionnent sous forme d'abonnement. Sauf resiliation avant la date de renouvellement, les abonnements sont automatiquement renouveles.",
      "L'Utilisateur peut resilier son abonnement depuis les parametres du compte. Les sommes deja payees restent dues et non remboursables sauf disposition legale contraire.",
    ],
  },
  {
    title: '13. Politique de remboursement',
    body: [
      'Les produits numeriques, abonnements et services deja executes ne sont pas remboursables sauf obligation legale.',
      'En cas de probleme technique imputable a DOUMASSI, une solution alternative ou un remboursement partiel peut etre propose.',
    ],
  },
  {
    title: '14. Propriete intellectuelle',
    body: [
      'Tous les elements de DOUMASSI sont proteges par les lois relatives a la propriete intellectuelle.',
      'Sont notamment proteges : le nom DOUMASSI, le logo, les logiciels, les interfaces, les algorithmes, les designs, les bases de donnees et les contenus produits par DOUMASSI.',
      'Toute reproduction non autorisee est interdite.',
    ],
  },
  {
    title: '15. Donnees personnelles',
    body: [
      'DOUMASSI collecte et traite certaines donnees personnelles necessaires au fonctionnement des services.',
      'Les donnees peuvent inclure : nom, adresse e-mail, numero de telephone, informations de paiement, donnees de navigation et contenus publies.',
      "Le traitement des donnees est regi par la Politique de Confidentialite de DOUMASSI. L'Utilisateur dispose des droits prevus par les reglementations applicables, notamment droit d'acces, droit de rectification, droit a l'effacement, droit d'opposition et droit a la portabilite.",
    ],
  },
  {
    title: '16. Securite',
    body: [
      'DOUMASSI met en oeuvre des mesures raisonnables de securite.',
      "Cependant, aucun systeme informatique ne peut garantir une securite absolue. L'Utilisateur reconnait utiliser les services a ses propres risques.",
    ],
  },
  {
    title: '17. Disponibilite des services',
    body: [
      "DOUMASSI s'efforce d'assurer la disponibilite continue des services.",
      "Cependant, l'Application peut etre interrompue temporairement pour maintenance, mises a jour, incidents techniques ou raisons de securite.",
      'DOUMASSI ne garantit pas une disponibilite ininterrompue.',
    ],
  },
  {
    title: '18. Limitation de responsabilite',
    body: [
      "Dans les limites autorisees par la loi, DOUMASSI ne pourra etre tenu responsable des pertes indirectes, pertes de donnees, pertes financieres, interruptions de service, contenus publies par les utilisateurs, actes de tiers ou decisions prises sur la base des contenus generes par l'IA.",
      "La responsabilite totale de DOUMASSI ne pourra exceder les montants effectivement payes par l'Utilisateur au cours des douze derniers mois.",
    ],
  },
  {
    title: '19. Resiliation',
    body: [
      "L'Utilisateur peut supprimer son compte a tout moment.",
      "DOUMASSI peut suspendre ou resilier un compte en cas de violation des presentes conditions, d'activite frauduleuse, de risque pour la securite ou d'obligation legale.",
      'Certaines donnees peuvent etre conservees conformement aux obligations legales.',
    ],
  },
  {
    title: '20. Publicite et contenus sponsorises',
    body: [
      "L'Application peut afficher des publicites, des contenus sponsorises et des recommandations commerciales.",
      "DOUMASSI peut personnaliser les publicites selon l'activite de l'Utilisateur conformement a la reglementation applicable.",
    ],
  },
  {
    title: '21. Services tiers',
    body: [
      "L'Application peut integrer des services tiers.",
      "DOUMASSI n'est pas responsable des services, contenus ou politiques des tiers.",
      "L'utilisation de services tiers peut etre soumise a des conditions supplementaires.",
    ],
  },
  {
    title: '22. Force majeure',
    body: [
      "DOUMASSI ne pourra etre tenu responsable d'un retard ou d'une inexecution resultant d'un evenement independant de sa volonte.",
    ],
  },
  {
    title: '23. Droit applicable',
    body: [
      "Les presentes conditions sont regies par les lois applicables dans le pays d'etablissement de DOUMASSI, sauf dispositions imperatives contraires.",
      'Tout litige sera soumis aux juridictions competentes.',
    ],
  },
  {
    title: '24. Contact',
    body: ['Pour toute question concernant les presentes conditions : contact@doumassi.com'],
  },
];
