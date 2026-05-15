import type { LegalSection } from './cgv-fr';

export const PRIVACY_FR_TITLE = 'Politique de confidentialité (RGPD)';

export const PRIVACY_FR_UPDATED_AT = '13 mai 2026';

export const privacyFrSections: LegalSection[] = [
  {
    title: '1. Responsable du traitement',
    body: [
      'DOUMASSI (D) agit en tant que responsable du ' +
        'traitement des données personnelles collectées ' +
        "via l'application (Contact : contact@doumassi.com).",
      'Nous nous engageons à protéger votre vie privée ' +
        'conformément au Règlement Général sur la ' +
        'Protection des Données (RGPD) et aux ' +
        'législations locales en vigueur.',
    ],
  },
  {
    title: '2. Données collectées',
    body: [
      'Nous collectons les catégories de données ' +
        "suivantes : informations d'identification " +
        '(nom, e-mail, date de naissance), données de ' +
        'profil (username, avatar, biographie), contenus ' +
        'publiés (publications, commentaires, messages), ' +
        "interactions avec l'IA, informations de " +
        'paiement (gérées par des prestataires tiers ' +
        'sécurisés) et données techniques (adresse IP, ' +
        "type d'appareil, journaux d'utilisation).",
    ],
  },
  {
    title: '3. Finalités du traitement',
    body: [
      'Vos données sont traitées pour : la fourniture ' +
        'et la gestion de votre compte, la ' +
        'personnalisation des contenus via ' +
        "l'intelligence artificielle, le fonctionnement " +
        'de la marketplace, la sécurité et la prévention ' +
        "de la fraude, l'amélioration technique de " +
        "l'application, et le respect de nos obligations " +
        'légales.',
    ],
  },
  {
    title: '4. Base légale du traitement',
    body: [
      "Le traitement est fondé sur : l'exécution du " +
        'contrat (CGU/CGV), votre consentement spécifique ' +
        "(pour certaines utilisations de l'IA ou cookies " +
        "optionnels), l'intérêt légitime de DOUMASSI " +
        '(sécurité, amélioration), et le respect des ' +
        'obligations légales auxquelles nous sommes ' +
        'soumis.',
    ],
  },
  {
    title: '5. Destinataires des données',
    body: [
      'Vos données sont destinées exclusivement à ' +
        'DOUMASSI et à ses sous-traitants techniques ' +
        '(ex: Supabase, OpenAI, Mistral, Tavily, Stripe).',
      'Nous ne vendons jamais vos données personnelles ' + 'à des tiers.',
      'Les données publiques du profil sont visibles ' +
        'par les autres utilisateurs selon vos ' +
        'paramètres de confidentialité.',
    ],
  },
  {
    title: '6. Transferts internationaux',
    body: [
      'Certaines données peuvent être transférées hors ' +
        "de l'Espace Économique Européen (EEE), " +
        'notamment vers les USA pour OpenAI. Dans ce ' +
        'cas, nous assurons un niveau de protection ' +
        'équivalent via des clauses contractuelles types ' +
        'de la Commission européenne ou des décisions ' +
        "d'adéquation.",
    ],
  },
  {
    title: '7. Durée de conservation',
    body: [
      'Nous conservons vos données tant que votre ' + 'compte est actif.',
      'En cas de suppression du compte, les données ' +
        'sont effacées ou anonymisées sous 30 jours ' +
        'après la demande, sauf si une conservation plus ' +
        'longue est imposée par la loi (ex : données ' +
        'de facturation pendant 10 ans).',
    ],
  },
  {
    title: '8. Cookies et traceurs',
    body: [
      "L'application utilise des traceurs techniques " +
        'essentiels au fonctionnement (expo-secure-store).',
      'Des traceurs optionnels pour les analyses et le ' +
        'suivi des erreurs (Sentry, PostHog) peuvent ' +
        'être utilisés avec votre consentement, que ' +
        'vous pouvez retirer à tout moment dans les ' +
        'paramètres.',
    ],
  },
  {
    title: '9. Vos droits',
    body: [
      'Conformément au RGPD, vous disposez des droits ' +
        "suivants : droit d'accès, de rectification, " +
        "d'effacement, d'opposition, de limitation du " +
        'traitement et de portabilité de vos données.',
      'Vous pouvez exercer ces droits via les ' +
        "paramètres de l'application ou en contactant " +
        'privacy@doumassi.com.',
      "Vous avez également le droit d'introduire une " + 'réclamation auprès de la CNIL.',
    ],
  },
  {
    title: '10. Mineurs',
    body: [
      "DOUMASSI n'est pas destiné aux enfants de moins " + 'de 13 ans sans supervision parentale.',
      'Si nous découvrons avoir collecté des données ' +
        "d'un mineur sans autorisation parentale, nous " +
        'les supprimerons immédiatement.',
    ],
  },
  {
    title: '11. Sécurité',
    body: [
      'Nous mettons en œuvre des mesures techniques et ' +
        'organisationnelles rigoureuses (chiffrement, ' +
        'RLS, authentification OAuth, et futur MFA) ' +
        'pour protéger vos données contre tout accès ' +
        'non autorisé, perte ou altération.',
    ],
  },
  {
    title: '12. Modifications et contact',
    body: [
      'Cette politique peut être mise à jour. Nous ' +
        'vous informerons de tout changement ' +
        'significatif.',
      'Pour toute question : privacy@doumassi.com.',
    ],
  },
];
