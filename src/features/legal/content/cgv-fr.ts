export type LegalSection = {
  title: string;
  body: string[];
};

export const CGV_FR_TITLE =
  "Conditions générales d'utilisation (CGU) et Conditions générales de vente (CGV)";

export const CGV_FR_UPDATED_AT = '11 mai 2026';

export const cgvFrSections: LegalSection[] = [
  {
    title: '1. Informations générales',
    body: [
      "Les présentes Conditions Générales d'Utilisation (CGU) et Conditions Générales de Vente (CGV) régissent l'accès et l'utilisation de l'application DOUMASSI (D, la Plateforme, l'Application), ainsi que les services associés.",
      "DOUMASSI est une plateforme numérique multifonctions intégrant notamment : un réseau social, des fonctionnalités communautaires, des outils d'intelligence artificielle, une marketplace, des services de paiement, des contenus numériques, des services cloud et logiciels, et des fonctionnalités de communication.",
      "En accédant à l'Application ou en utilisant ses services, l'utilisateur accepte pleinement et sans réserve les présentes conditions.",
    ],
  },
  {
    title: '2. Définitions',
    body: [
      "Application désigne la plateforme DOUMASSI (D). Utilisateur désigne toute personne physique ou morale utilisant l'Application. Compte désigne l'espace personnel créé par l'Utilisateur. Contenu désigne tout texte, image, vidéo, audio, publication, commentaire, message ou donnée publié sur la plateforme. Services désigne l'ensemble des fonctionnalités proposées par DOUMASSI. Marketplace désigne l'espace de vente de produits ou services. IA désigne les fonctionnalités d'intelligence artificielle intégrées à la plateforme.",
    ],
  },
  {
    title: '3. Acceptation des conditions',
    body: [
      "L'utilisation de l'Application implique l'acceptation complète des présentes CGU/CGV.",
      "Si l'Utilisateur n'accepte pas ces conditions, il ne doit pas utiliser l'Application.",
      'DOUMASSI se réserve le droit de modifier les présentes conditions à tout moment. Les modifications prennent effet dès leur publication sur la plateforme.',
    ],
  },
  {
    title: "4. Conditions d'accès",
    body: [
      "L'accès à certains services nécessite la création d'un compte.",
      "L'Utilisateur s'engage à fournir des informations exactes, maintenir la confidentialité de ses identifiants, ne pas usurper l'identité d'un tiers et utiliser l'Application conformément aux lois applicables.",
      'DOUMASSI peut suspendre ou supprimer un compte en cas de violation des présentes conditions.',
    ],
  },
  {
    title: '5. Âge minimum',
    body: [
      "L'utilisation de l'Application est réservée aux personnes âgées d'au moins 13 ans ou de l'âge minimum requis dans le pays de résidence de l'Utilisateur.",
      "Les mineurs doivent utiliser l'Application sous la supervision d'un représentant légal.",
    ],
  },
  {
    title: '6. Utilisation autorisée',
    body: [
      "L'Utilisateur s'engage à ne pas publier de contenus illégaux, diffuser des contenus haineux, discriminatoires ou violents, harceler d'autres utilisateurs, publier des contenus pornographiques ou contraires aux bonnes mœurs, transmettre des virus ou logiciels malveillants, utiliser des robots, scripts ou systèmes automatisés non autorisés, collecter illégalement des données, porter atteinte aux droits de propriété intellectuelle ou contourner les mesures de sécurité de la plateforme.",
      'DOUMASSI se réserve le droit de supprimer tout contenu non conforme.',
    ],
  },
  {
    title: '7. Contenus publiés par les utilisateurs',
    body: [
      "L'Utilisateur reste propriétaire des contenus qu'il publie.",
      "En publiant du contenu sur DOUMASSI, l'Utilisateur accorde à DOUMASSI une licence mondiale, non exclusive, gratuite et transférable permettant l'hébergement, la reproduction, la diffusion, l'adaptation, la distribution, l'affichage et l'utilisation technique nécessaire au fonctionnement de la plateforme.",
      "Cette licence prend fin lors de la suppression du contenu, sauf obligations légales contraires. L'Utilisateur garantit disposer de tous les droits nécessaires sur les contenus publiés.",
    ],
  },
  {
    title: '8. Modération',
    body: [
      'DOUMASSI peut supprimer des contenus, limiter certaines fonctionnalités, suspendre temporairement un compte ou supprimer définitivement un compte.',
      'Les décisions de modération peuvent être prises automatiquement ou manuellement.',
    ],
  },
  {
    title: "9. Services d'intelligence artificielle",
    body: [
      "Certaines fonctionnalités de l'Application utilisent des systèmes d'intelligence artificielle.",
      "Les résultats générés par l'IA sont fournis à titre informatif. DOUMASSI ne garantit pas l'exactitude absolue des résultats, l'absence d'erreurs, l'absence de biais ou l'adéquation à un usage spécifique.",
      "L'Utilisateur reste seul responsable de l'utilisation des contenus générés.",
    ],
  },
  {
    title: '10. Marketplace',
    body: [
      "La plateforme peut permettre l'achat, la vente ou la promotion de produits et services.",
      'Les vendeurs sont seuls responsables des produits proposés, des descriptions, des garanties légales et du respect des lois applicables.',
      "DOUMASSI agit en qualité d'intermédiaire technique sauf mention contraire.",
    ],
  },
  {
    title: '11. Paiements',
    body: [
      'Certains services peuvent être payants. Les prix sont affichés dans la devise applicable et peuvent inclure les taxes légales.',
      "L'Utilisateur autorise DOUMASSI ou ses prestataires de paiement à débiter le moyen de paiement enregistré.",
      'DOUMASSI peut utiliser des prestataires tiers sécurisés pour le traitement des paiements.',
    ],
  },
  {
    title: '12. Abonnements',
    body: [
      "Certains services fonctionnent sous forme d'abonnement. Sauf résiliation avant la date de renouvellement, les abonnements sont automatiquement renouvelés.",
      "L'Utilisateur peut résilier son abonnement depuis les paramètres du compte. Les sommes déjà payées restent dues et non remboursables sauf disposition légale contraire.",
    ],
  },
  {
    title: '13. Politique de remboursement',
    body: [
      'Les produits numériques, abonnements et services déjà exécutés ne sont pas remboursables sauf obligation légale.',
      'En cas de problème technique imputable à DOUMASSI, une solution alternative ou un remboursement partiel peut être proposé.',
    ],
  },
  {
    title: '14. Propriété intellectuelle',
    body: [
      'Tous les éléments de DOUMASSI sont protégés par les lois relatives à la propriété intellectuelle.',
      'Sont notamment protégés : le nom DOUMASSI, le logo, les logiciels, les interfaces, les algorithmes, les designs, les bases de données et les contenus produits par DOUMASSI.',
      'Toute reproduction non autorisée est interdite.',
    ],
  },
  {
    title: '15. Données personnelles',
    body: [
      'DOUMASSI collecte et traite certaines données personnelles nécessaires au fonctionnement des services.',
      'Les données peuvent inclure : nom, adresse e-mail, numéro de téléphone, informations de paiement, données de navigation et contenus publiés.',
      "Le traitement des données est régi par la Politique de Confidentialité de DOUMASSI. L'Utilisateur dispose des droits prévus par les réglementations applicables, notamment droit d'accès, droit de rectification, droit à l'effacement, droit d'opposition et droit à la portabilité.",
    ],
  },
  {
    title: '16. Sécurité',
    body: [
      'DOUMASSI met en œuvre des mesures raisonnables de sécurité.',
      "Cependant, aucun système informatique ne peut garantir une sécurité absolue. L'Utilisateur reconnaît utiliser les services à ses propres risques.",
    ],
  },
  {
    title: '17. Disponibilité des services',
    body: [
      "DOUMASSI s'efforce d'assurer la disponibilité continue des services.",
      "Cependant, l'Application peut être interrompue temporairement pour maintenance, mises à jour, incidents techniques ou raisons de sécurité.",
      'DOUMASSI ne garantit pas une disponibilité ininterrompue.',
    ],
  },
  {
    title: '18. Limitation de responsabilité',
    body: [
      "Dans les limites autorisées par la loi, DOUMASSI ne pourra être tenu responsable des pertes indirectes, pertes de données, pertes financières, interruptions de service, contenus publiés par les utilisateurs, actes de tiers ou décisions prises sur la base des contenus générés par l'IA.",
      "La responsabilité totale de DOUMASSI ne pourra excéder les montants effectivement payés par l'Utilisateur au cours des douze derniers mois.",
    ],
  },
  {
    title: '19. Résiliation',
    body: [
      "L'Utilisateur peut supprimer son compte à tout moment.",
      "DOUMASSI peut suspendre ou résilier un compte en cas de violation des présentes conditions, d'activité frauduleuse, de risque pour la sécurité ou d'obligation légale.",
      'Certaines données peuvent être conservées conformément aux obligations légales.',
    ],
  },
  {
    title: '20. Publicité et contenus sponsorisés',
    body: [
      "L'Application peut afficher des publicités, des contenus sponsorisés et des recommandations commerciales.",
      "DOUMASSI peut personnaliser les publicités selon l'activité de l'Utilisateur conformément à la réglementation applicable.",
    ],
  },
  {
    title: '21. Services tiers',
    body: [
      "L'Application peut intégrer des services tiers.",
      "DOUMASSI n'est pas responsable des services, contenus ou politiques des tiers.",
      "L'utilisation de services tiers peut être soumise à des conditions supplémentaires.",
    ],
  },
  {
    title: '22. Force majeure',
    body: [
      "DOUMASSI ne pourra être tenu responsable d'un retard ou d'une inexécution résultant d'un événement indépendant de sa volonté.",
    ],
  },
  {
    title: '23. Droit applicable',
    body: [
      "Les présentes conditions sont régies par les lois applicables dans le pays d'établissement de DOUMASSI, sauf dispositions impératives contraires.",
      'Tout litige sera soumis aux juridictions compétentes.',
    ],
  },
  {
    title: '24. Contact',
    body: ['Pour toute question concernant les présentes conditions : contact@doumassi.com'],
  },
];
