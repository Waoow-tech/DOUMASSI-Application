// Dictionnaire FRANÇAIS — namespace `marketplace` (E11-06).
// Tutoiement volontaire (cohérent avec le ton de l'app).
// Clés structurées par écran/composant. Les objets `condition` et `badge`
// sont volontairement keyés sur les valeurs d'enum DB (product/service, neuf…)
// pour permettre un lookup direct `t.marketplace.condition[listing.condition]` :
// on ne traduit PAS l'enum métier stocké en base, seulement son libellé UI.

export const marketplaceFr = {
  // Libellés partagés entre plusieurs écrans.
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    pullToRetry: 'Tire vers le bas pour réessayer.',
  },

  // Icône signet (grille, carte, fiche produit).
  bookmark: {
    add: 'Ajouter aux favoris',
    remove: 'Retirer des favoris',
  },

  // Libellés d'état produit (mappés sur l'enum `listing_condition`).
  condition: {
    neuf: 'Neuf',
    tres_bon_etat: 'Très bon état',
    bon_etat: 'Bon état',
    occasion: 'Occasion',
  },

  // Badges promo (mappés sur l'enum `listing_badge`).
  badge: {
    offre_speciale: 'Offre spéciale',
    nouveaute: 'Nouveauté',
    recommandation: 'Recommandation',
  },

  // Dates relatives affichées sur la fiche produit.
  relativeTime: {
    justNow: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
    weeks: (n: number) => `il y a ${n} sem`,
    months: (n: number) => `il y a ${n} mois`,
    years: (n: number) => `il y a ${n} an`,
  },

  // Écran grille — app/shop/index.tsx
  grid: {
    title: 'Boutique',
    bookmarksA11yLabel: 'Mes favoris',
    bookmarksA11yHint: 'Tap pour voir les annonces que tu as sauvegardées',
    createA11yLabel: 'Publier une annonce',
    createA11yHint: 'Tap pour créer une nouvelle annonce',
    searchPlaceholder: 'Rechercher',
    searchA11yLabel: 'Rechercher une annonce',
    clearSearchA11yLabel: 'Effacer la recherche',
    errorTitle: 'Impossible de charger la boutique',
    emptyTitle: 'Aucune annonce trouvée',
    emptySearch: (query: string) => `Rien ne correspond à "${query}".`,
    emptyNoFilters: 'Reviens plus tard ou ajuste tes filtres.',
  },

  // Écran fiche produit — app/shop/[id].tsx
  detail: {
    imageA11y: (title: string) => `Image de l'annonce ${title}`,
    notFoundTitle: 'Annonce introuvable',
    notFoundSubtitle: 'Cette annonce a peut-être été supprimée ou désactivée.',
    descriptionLabel: 'Description',
    sellerLabel: 'Vendeur',
    views: (n: number) => `${n} vue${n > 1 ? 's' : ''}`,
    ownListing: "C'est votre annonce",
    contactSellerCta: 'Contacter le vendeur',
    contactSellerA11y: (name: string) => `Contacter ${name}`,
    contactSellerHint: 'Ouvre une conversation avec le vendeur, message pré-rempli',
    contactPrefill: (title: string) =>
      `Bonjour, je suis intéressé(e) par votre annonce '${title}'.`,
    contactErrorTitle: 'Impossible de contacter ce vendeur',
    contactErrorFallback: 'Réessaie dans un instant.',
  },

  // Écran création d'annonce — app/shop/create.tsx
  create: {
    title: 'Nouvelle annonce',
    optional: 'Optionnel',
    sections: {
      photos: 'Photos',
      category: 'Catégorie',
      title: 'Titre',
      description: 'Description',
      price: 'Prix',
      condition: 'État',
      location: 'Localisation',
    },
    category: {
      product: 'Produit',
      service: 'Service',
    },
    titlePlaceholder: 'Ex : Casque audio sans fil',
    titleA11y: "Titre de l'annonce",
    descriptionPlaceholder: 'Décris ton article : état, accessoires inclus, raison de la vente…',
    descriptionA11y: "Description de l'annonce",
    pricePlaceholder: '0,00',
    priceA11y: 'Prix en euros',
    locationPlaceholder: 'Ex : Paris 11ème',
    locationA11y: 'Localisation',
    uploadProgress: (done: number, total: number) => `Upload des photos ${done}/${total}…`,
    submitCta: 'Publier',
    submitA11y: "Publier l'annonce",
    discardTitle: 'Abandonner cette annonce ?',
    discardMessage: 'Tu perdras ce que tu as saisi.',
    discardKeepEditing: 'Continuer la saisie',
    discardConfirm: 'Abandonner',
    submitErrorTitle: 'Publication impossible',
    submitErrorFallback: 'Une erreur est survenue, réessaie.',
    errors: {
      imageRequired: 'Ajoute au moins 1 photo.',
      titleMin: 'Le titre doit faire au moins 3 caractères.',
      descriptionMin: 'Décris ton annonce en au moins 10 caractères.',
      maxChars: (max: number) => `Maximum ${max} caractères.`,
      priceRequired: 'Indique un prix.',
      priceFormat: 'Format invalide (ex: 12,50)',
      priceRange: (max: number) => `Prix entre 0,01 € et ${max} €.`,
      conditionProductOnly: "L'état ne s'applique qu'aux produits.",
    },
  },

  // Écran favoris — app/shop/bookmarks.tsx
  bookmarks: {
    title: 'Mes favoris',
    errorTitle: 'Impossible de charger tes favoris',
    emptyTitle: "Aucun favori pour l'instant",
    emptySubtitle: "Touche l'icône signet sur une annonce pour la retrouver ici.",
    discoverCta: 'Découvrir la boutique',
  },

  // Modale de filtres avancés — AdvancedFiltersSheet
  filters: {
    title: 'Filtres',
    reset: 'Réinitialiser',
    resetA11y: 'Réinitialiser les filtres',
    sortBy: 'Trier par',
    price: 'Prix',
    condition: 'État',
    min: 'Min',
    minA11y: 'Prix minimum en euros',
    max: 'Max',
    maxA11y: 'Prix maximum en euros',
    to: 'à',
    apply: 'Appliquer',
    applyA11y: 'Appliquer les filtres',
    priceError: 'Le prix min doit être inférieur au prix max.',
    sort: {
      recent: 'Récent',
      priceAsc: 'Prix ↑',
      priceDesc: 'Prix ↓',
      popular: 'Populaire',
    },
  },

  // Barre de filtres rapides — QuickFiltersBar
  quickFilters: {
    sort: 'Trier',
    price: 'Prix',
    condition: 'État',
    distance: 'Distance',
    filterA11y: (label: string) => `Filtre ${label}`,
    filterHint: 'Tap pour ouvrir les filtres avancés',
    advancedA11y: 'Filtres avancés',
    advancedHint: 'Tap pour ouvrir tous les filtres',
  },

  // Chips de catégorie — CategoryChips
  categoryChips: {
    all: 'Tout',
    products: 'Produits',
    services: 'Services',
  },

  // Carte produit dans la grille — ListingCard
  card: {
    viewProduct: 'Voir le produit',
    viewProductA11y: (title: string) => `Voir le produit ${title}`,
    discountA11y: (percent: number) => `moins ${percent} pourcent`,
    soldByA11y: (name: string) => `vendu par ${name}`,
  },

  // Sélecteur de photos — ListingImagePicker
  imagePicker: {
    addPhoto: 'Ajouter une photo',
    addPhotoCount: (count: number, max: number) => `Ajouter une photo (${count}/${max})`,
    addMessage: (n: number) => `Tu peux ajouter encore ${n} photo${n > 1 ? 's' : ''}.`,
    gallery: 'Galerie',
    camera: 'Caméra',
    cameraDeniedTitle: 'Caméra non autorisée',
    cameraDeniedMessage: 'Active la caméra dans les réglages pour prendre une photo.',
    removeA11y: (position: number) => `Supprimer la photo ${position}`,
    cover: 'COUVERTURE',
    coverHint: 'La 1ère photo sera utilisée comme couverture. Glisse pour réorganiser bientôt.',
  },

  // Carousel d'images de la fiche produit — ListingImageCarousel
  carousel: {
    noImage: 'Aucune image',
    defaultImage: "Image de l'annonce",
    image: 'Image',
    imageCounter: (base: string, position: number, total: number) =>
      `${base} — ${position} sur ${total}`,
  },

  // Carte vendeur — SellerCard
  seller: {
    viewProfileA11y: (name: string) => `Voir le profil de ${name}`,
    viewProfileHint: 'Tap pour ouvrir le profil du vendeur',
  },

  // Rangée d'annonces similaires — SimilarListingsRow
  similar: {
    title: 'Annonces similaires',
  },
};

export type MarketplaceTranslations = typeof marketplaceFr;
