// ENGLISH dictionary for the `profileScreens` namespace — E11-03.
// Must cover exactly the same keys as fr/profileScreens.ts (typed against
// ProfileScreensTranslations), otherwise TypeScript errors.

import type { ProfileScreensTranslations } from '../fr/profileScreens';

export const profileScreensEn: ProfileScreensTranslations = {
  common: {
    cancel: 'Cancel',
    goBack: 'Go back',
    back: 'Back',
    takePhoto: 'Take a photo',
    chooseFromGallery: 'Choose from gallery',
    logoAccessibilityLabel: 'DOUMASSI logo',
  },

  profileHeader: {
    kebabAccessibilityLabel: 'More options',
  },

  searchBar: {
    placeholder: 'Search…',
  },

  unfollowModal: {
    title: (username: string) => `Unfollow @${username}?`,
    message: 'You’ll stop seeing their posts.',
    confirm: 'Unfollow',
  },

  blockModal: {
    title: (username: string) => `Block @${username}?`,
    message:
      'They won’t be able to find your profile, posts or contact you. They won’t be notified.',
    confirm: 'Block',
  },

  followButton: {
    follow: 'Follow',
    requested: 'Requested ✕',
    following: 'Following',
  },

  followRelation: {
    followersTab: 'Followers',
    followingTab: 'Following',
    follow: 'Follow',
    followBack: 'Follow back',
    following: 'Following',
    requested: 'Requested',
    searchFollowers: 'Search followers…',
    searchFollowing: 'Search following…',
    noFollowers: 'No followers yet',
    noFollowersSubtitle: 'Share your profile to get started',
    noFollowing: 'Not following anyone yet',
    noFollowingSubtitle: 'Discover people to follow',
  },

  listingCard: {
    badgePromo: 'Sale',
    badgeNew: 'New',
    badgeReco: 'Pick',
    viewProduct: 'View product',
    viewProductAccessibility: (title: string, price: string) => `View product ${title}, ${price}`,
  },

  shopEmptyState: {
    noListingsMine: 'No listings yet',
    noListingsOther: 'No products for sale',
    publishFirst: 'Post your first listing',
  },

  completeProfile: {
    title: 'Complete your profile',
    subtitle: 'Help others recognize you on\nDOUMASSI.',
    addPhoto: 'Add a profile picture',
    genderOptional: 'Gender (optional)',
    genderLabels: {
      male: 'Male',
      female: 'Female',
      other: 'Other',
    },
    bioPlaceholder: 'Bio (optional)',
    professionalAccount: 'Professional account',
    professionalHint:
      'Your account can be used to promote content and products related to your profession.',
    continue: 'Continue',
    skip: 'Skip for now',
    errorGeneric: 'An unexpected error occurred',
  },

  editProfile: {
    title: 'Edit profile',
    changePhoto: 'Change photo',
    notSet: 'Not set',
    fullNameLabel: 'Full name',
    fullNamePlaceholder: 'Full name',
    usernameLabel: 'Username',
    usernamePlaceholder: 'username',
    usernameCooldownInline: (nextDate: string, days: number) =>
      `You can change your username again on ${nextDate} (${days} days remaining)`,
    usernameChecking: 'Checking username…',
    usernameTaken: 'This username is already taken',
    usernameAvailable: 'Username available',
    bioLabel: 'Bio',
    bioPlaceholder: 'Bio',
    birthdayLabel: 'Birthday',
    birthdayHint: 'Birthday cannot be changed. Contact support if needed.',
    emailLabel: 'Email',
    coverPhoto: 'Cover photo',
    changeCover: 'Change cover',
    professionalAccount: 'Professional account',
    professionalHint: 'Show your profile as a professional account.',
    save: 'Save',
    profileSaved: 'Profile saved',
    cooldownAlertTitle: 'Username cooldown',
    cooldownAlertMessage: (nextDate: string) => `You can change your username again on ${nextDate}`,
    updateFailed: 'Profile update failed.',
    couldNotSave: 'Could not save profile',
    unavailableTitle: 'Profile unavailable',
    unavailableMessage: 'Please try again in a moment.',
  },

  otherProfile: {
    userNotAvailable: 'User not available',
    blockErrorTitle: 'Error',
    blockErrorMessage: 'Could not block this user. Please try again.',
    report: 'Report',
    reportMessage: 'Report feature coming soon.',
    reportSheet: {
      title: 'Report this profile',
      reasons: {
        inapproprie: 'Inappropriate content',
        harcelement: 'Harassment or bullying',
        spam: 'Spam or scam',
        faux_profil: 'Fake profile / impersonation',
        autre: 'Other',
      },
      successTitle: 'Thank you',
      successMessage: 'Your report has been sent to moderation.',
      errorTitle: 'Report failed',
      errorOwn: 'You cannot report your own profile.',
      errorGeneric: 'Something went wrong. Please try again.',
    },
    shareMessage: (username: string) =>
      `Check out @${username}’s profile on DOUMASSI! 🚀\nhttps://doumassi.app/u/${username}`,
    messageButton: 'Message',
    userNotFound: 'User not found',
    userNotFoundSubtitle: 'This account may have been deleted or doesn’t exist.',
    accountPrivate: (username: string) =>
      `This account is private.\nFollow @${username} to see their posts.`,
    shareProfile: 'Share profile',
    blockUser: (username: string) => `Block @${username}`,
    userBlockedToast: 'User blocked',
  },

  resolveUsername: {
    notFoundTitle: 'User not found',
    notFoundMessage: (username: string) => `@${username} doesn’t exist or was deleted.`,
    invalidUsername: 'Invalid username.',
    errorTitle: 'Loading error',
  },

  settings: {
    title: 'Settings',
    profileUnavailable: 'Profile unavailable.',
    backAccessibilityLabel: 'Back',
    sectionPrivacy: 'Privacy',
    sectionNotifications: 'Notifications',
    sectionAccount: 'Account',
    sectionFeatures: 'DOUMASSI features',
    sectionModeration: 'Moderation',
    sectionLegal: 'Legal',
    sectionHelp: 'Help',
    privateProfile: 'Private profile',
    hiddenPosts: 'Hidden posts',
    pushNotifications: 'Push notifications',
    emailNotifications: 'Email notifications',
    editProfile: 'Edit my profile',
    changePassword: 'Change password',
    exportData: 'Export my data',
    deleteAccount: 'Delete my account',
    blockedUsers: 'Blocked users',
    terms: 'Terms of use',
    privacyPolicy: 'Privacy policy',
    contactUs: 'Contact us',
    about: 'About',
    featureWallet: 'Wallet',
    featureMatching: 'Connect',
    featureAi: 'AI',
    featureMarketplace: 'Marketplace',
    featureMessaging: 'Messaging',
    featureCalls: 'Calls',
    badgeSoon: 'Soon',
    profileCardUserFallback: 'User',
    profileCardNoEmail: 'No email',
    soonTitle: 'Coming soon',
    soonMessage: 'This feature is coming soon.',
    privacyErrorTitle: 'Update failed',
    privacyErrorMessage: 'The privacy change failed. Try again in a moment.',
    exportPartialTitle: 'Partial export',
    exportPartialMessage:
      'Your export contains a very large amount of data. The oldest messages were truncated. Contact support for a full export.',
    exportFailedTitle: 'Export failed',
    exportFailedMessage: 'The export failed. Try again in a moment or contact support.',
    aboutVersion: 'Version 1.0.0 — MVP June 2026',
    aboutRights: '© 2026 DOUMASSI. All rights reserved.',
  },

  changePassword: {
    title: 'Change password',
    currentPasswordLabel: 'Current password',
    newPasswordLabel: 'New password',
    confirmPasswordLabel: 'Confirm new password',
    currentPasswordRequired: 'Current password required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordUppercase: 'Password must contain at least 1 uppercase letter',
    passwordDigit: 'Password must contain at least 1 digit',
    confirmationRequired: 'Confirmation required',
    newPasswordDifferent: 'The new password must be different',
    passwordsDoNotMatch: 'Passwords do not match',
    samePasswordError: 'The new password must be different from the old one',
    submit: 'Update password',
    toast: 'Password updated',
    emailUnavailable: 'Account email unavailable',
    currentPasswordIncorrect: 'Current password is incorrect',
  },

  deleteAccount: {
    title: 'Delete my account',
    cancelledTitle: 'Request cancelled',
    cancelledMessage: 'Your deletion request has been cancelled. Your account stays active.',
    errorTitle: 'Error',
    cancelFailedMessage: 'The cancellation failed. Try again in a moment or contact support.',
    scheduledTitle: 'Scheduled deletion',
    scheduledBefore: 'Your account will be permanently deleted on ',
    scheduledHint:
      'You can cancel this request at any time before that date by coming back here. Once the date has passed, deletion is final and irreversible.',
    reasonGiven: 'Reason given',
    cancelRequestButton: 'Cancel deletion request',
    irreversibleTitle: 'Irreversible action',
    irreversibleMessage:
      'All your data will be deleted 30 days after your request. You can cancel at any time before then.',
    whatWillBeDeleted: 'What will be deleted',
    deletedItems: [
      'Your profile (photo, bio, username)',
      'Your posts and comments',
      'Your private messages',
      'Your followers and following',
      'Your login history',
    ],
    reasonLabel: 'Why are you leaving? (optional)',
    reasonPlaceholder: 'Your feedback helps us improve DOUMASSI…',
    requestButton: 'Request account deletion',
    sureTitle: 'Are you sure?',
    confirmBefore: 'Type ',
    confirmAfter: ' to confirm the deletion of your account.',
    confirmDelete: 'Confirm deletion',
    requestFailedMessage: 'The request could not be saved. Try again in a moment.',
    requestRecordedTitle: 'Request recorded',
    requestRecordedMessage:
      'Your account will be deleted in 30 days. Sign back in before that date to cancel.',
  },

  blockedUsers: {
    title: 'Blocked users',
    unblock: 'Unblock',
    unblockErrorTitle: 'Could not unblock user',
    unblockErrorMessage: 'Please try again in a moment.',
    emptyTitle: 'No blocked users',
    emptySubtitle: 'You haven’t blocked anyone yet.',
    unblockedToast: 'User unblocked',
  },

  hiddenPosts: {
    title: 'Hidden posts',
    loading: 'Loading…',
    postUnavailable: 'Post unavailable',
    restore: 'Show again',
    emptyTitle: 'No hidden posts',
    restoredToast: 'Display restored',
  },
};
