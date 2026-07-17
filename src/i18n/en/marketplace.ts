// ENGLISH dictionary — `marketplace` namespace (E11-06).
// Must mirror exactly the keys of ../fr/marketplace (TypeScript enforces it).

import type { MarketplaceTranslations } from '../fr/marketplace';

export const marketplaceEn: MarketplaceTranslations = {
  common: {
    back: 'Back',
    cancel: 'Cancel',
    pullToRetry: 'Pull down to try again.',
  },

  bookmark: {
    add: 'Add to bookmarks',
    remove: 'Remove from bookmarks',
  },

  condition: {
    neuf: 'New',
    tres_bon_etat: 'Very good condition',
    bon_etat: 'Good condition',
    occasion: 'Used',
  },

  badge: {
    offre_speciale: 'Special offer',
    nouveaute: 'New arrival',
    recommandation: 'Recommended',
  },

  relativeTime: {
    justNow: 'just now',
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
    weeks: (n: number) => `${n}w ago`,
    months: (n: number) => `${n}mo ago`,
    years: (n: number) => `${n}y ago`,
  },

  grid: {
    title: 'Shop',
    bookmarksA11yLabel: 'My bookmarks',
    bookmarksA11yHint: 'Tap to see the listings you saved',
    createA11yLabel: 'Post a listing',
    createA11yHint: 'Tap to create a new listing',
    searchPlaceholder: 'Search',
    searchA11yLabel: 'Search a listing',
    clearSearchA11yLabel: 'Clear search',
    errorTitle: "Couldn't load the shop",
    emptyTitle: 'No listings found',
    emptySearch: (query: string) => `Nothing matches "${query}".`,
    emptyNoFilters: 'Check back later or adjust your filters.',
  },

  detail: {
    imageA11y: (title: string) => `Listing image for ${title}`,
    notFoundTitle: 'Listing not found',
    notFoundSubtitle: 'This listing may have been removed or deactivated.',
    descriptionLabel: 'Description',
    sellerLabel: 'Seller',
    views: (n: number) => `${n} view${n > 1 ? 's' : ''}`,
    ownListing: 'This is your listing',
    contactSellerCta: 'Contact the seller',
    contactSellerA11y: (name: string) => `Contact ${name}`,
    contactSellerHint: 'Opens a conversation with the seller, message pre-filled',
    contactPrefill: (title: string) => `Hi, I'm interested in your listing '${title}'.`,
    contactErrorTitle: "Couldn't contact this seller",
    contactErrorFallback: 'Try again in a moment.',
  },

  create: {
    title: 'New listing',
    optional: 'Optional',
    sections: {
      photos: 'Photos',
      category: 'Category',
      title: 'Title',
      description: 'Description',
      price: 'Price',
      condition: 'Condition',
      location: 'Location',
    },
    category: {
      product: 'Product',
      service: 'Service',
    },
    titlePlaceholder: 'e.g. Wireless headphones',
    titleA11y: 'Listing title',
    descriptionPlaceholder:
      'Describe your item: condition, accessories included, reason for selling…',
    descriptionA11y: 'Listing description',
    pricePlaceholder: '0.00',
    priceA11y: 'Price in euros',
    locationPlaceholder: 'e.g. Paris 11th',
    locationA11y: 'Location',
    uploadProgress: (done: number, total: number) => `Uploading photos ${done}/${total}…`,
    submitCta: 'Publish',
    submitA11y: 'Publish the listing',
    discardTitle: 'Discard this listing?',
    discardMessage: "You'll lose what you entered.",
    discardKeepEditing: 'Keep editing',
    discardConfirm: 'Discard',
    submitErrorTitle: 'Could not publish',
    submitErrorFallback: 'Something went wrong, try again.',
    errors: {
      imageRequired: 'Add at least 1 photo.',
      titleMin: 'The title must be at least 3 characters.',
      descriptionMin: 'Describe your listing in at least 10 characters.',
      maxChars: (max: number) => `${max} characters max.`,
      priceRequired: 'Enter a price.',
      priceFormat: 'Invalid format (e.g. 12.50)',
      priceRange: (max: number) => `Price between 0.01 € and ${max} €.`,
      conditionProductOnly: 'Condition only applies to products.',
    },
  },

  bookmarks: {
    title: 'My bookmarks',
    errorTitle: "Couldn't load your bookmarks",
    emptyTitle: 'No bookmarks yet',
    emptySubtitle: 'Tap the bookmark icon on a listing to find it here.',
    discoverCta: 'Explore the shop',
  },

  filters: {
    title: 'Filters',
    reset: 'Reset',
    resetA11y: 'Reset filters',
    sortBy: 'Sort by',
    price: 'Price',
    condition: 'Condition',
    min: 'Min',
    minA11y: 'Minimum price in euros',
    max: 'Max',
    maxA11y: 'Maximum price in euros',
    to: 'to',
    apply: 'Apply',
    applyA11y: 'Apply filters',
    priceError: 'The min price must be lower than the max price.',
    sort: {
      recent: 'Recent',
      priceAsc: 'Price ↑',
      priceDesc: 'Price ↓',
      popular: 'Popular',
    },
  },

  quickFilters: {
    sort: 'Sort',
    price: 'Price',
    condition: 'Condition',
    distance: 'Distance',
    filterA11y: (label: string) => `${label} filter`,
    filterHint: 'Tap to open advanced filters',
    advancedA11y: 'Advanced filters',
    advancedHint: 'Tap to open all filters',
  },

  categoryChips: {
    all: 'All',
    products: 'Products',
    services: 'Services',
  },

  card: {
    viewProduct: 'View product',
    viewProductA11y: (title: string) => `View product ${title}`,
    discountA11y: (percent: number) => `${percent} percent off`,
    soldByA11y: (name: string) => `sold by ${name}`,
  },

  imagePicker: {
    addPhoto: 'Add a photo',
    addPhotoCount: (count: number, max: number) => `Add a photo (${count}/${max})`,
    addMessage: (n: number) => `You can add ${n} more photo${n > 1 ? 's' : ''}.`,
    gallery: 'Gallery',
    camera: 'Camera',
    cameraDeniedTitle: 'Camera not allowed',
    cameraDeniedMessage: 'Enable the camera in settings to take a photo.',
    removeA11y: (position: number) => `Delete photo ${position}`,
    cover: 'COVER',
    coverHint: 'The 1st photo will be used as the cover. Drag to reorder soon.',
  },

  carousel: {
    noImage: 'No image',
    defaultImage: 'Listing image',
    image: 'Image',
    imageCounter: (base: string, position: number, total: number) =>
      `${base} — ${position} of ${total}`,
  },

  seller: {
    viewProfileA11y: (name: string) => `View ${name}'s profile`,
    viewProfileHint: 'Tap to open the seller profile',
  },

  similar: {
    title: 'Similar listings',
  },

  boost: {
    sponsoredTitle: 'Sponsored',
    sponsoredBadge: 'Sponsored',
    cta: 'Boost',
    confirmTitle: 'Boost my listing',
    confirmMessage: (cost: number, days: number, balance: number) =>
      `Feature your listing for ${days} days for ${cost} Dcoins.\nCurrent balance: ${balance} Dcoins.`,
    confirmAction: 'Boost',
    cancel: 'Cancel',
    successTitle: 'Listing boosted!',
    successMessage: (days: number) => `Your listing is featured for ${days} days.`,
    errorTitle: 'Could not boost',
    insufficient: 'Insufficient balance. Earn Dcoins to boost your listing.',
    genericError: 'Something went wrong. Please try again.',
    sending: 'Boosting…',
  },
};
