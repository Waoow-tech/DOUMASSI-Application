// ENGLISH dictionary — E11-01.
// Must cover exactly the same keys as fr.ts (typed as `Translations`, so a
// missing key is a TypeScript error).
//
// Sections splash/auth/profile/settings inline (fondation E11-01).
// Zones E11-02→09 agrégées depuis src/i18n/en/<zone>.ts (chaque fichier est typé
// contre son homologue FR → parité de clés garantie à la compilation).

import { commonEn } from './en/common';
import { coursEn } from './en/cours';
import { feedEn } from './en/feed';
import { gamesEn } from './en/games';
import { marketplaceEn } from './en/marketplace';
import { messagingEn } from './en/messaging';
import { notificationsEn } from './en/notifications';
import { profileScreensEn } from './en/profileScreens';
import { walletEn } from './en/wallet';
import type { Translations } from './fr';

export const en: Translations = {
  splash: {
    tagline: 'DOUMASSI',
  },
  auth: {
    welcome: {
      tagline: 'The French super-app.',
      signIn: 'Sign in',
      createAccount: 'Create an account',
    },
    common: {
      or: 'or',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
    },
    login: {
      title: 'Log in',
      identifierPlaceholder: 'Email address or phone number',
      passwordPlaceholder: 'Password',
      submit: 'Log in',
      forgotPassword: 'Forgot your password?',
      createAccount: 'Create an account',
    },
    signup: {
      usernameChecking: 'Checking…',
      usernameAvailable: 'Available',
      usernameTaken: 'Already taken',
      usernameCheckError: 'Could not verify, please retry.',
      title: 'Create an account',
      fullNamePlaceholder: 'Full name',
      usernamePlaceholder: 'Username',
      identifierPlaceholder: 'Email or phone number',
      birthdayPlaceholder: 'Birthday (DD/MM/YYYY)',
      passwordPlaceholder: 'Password',
      confirmPasswordPlaceholder: 'Confirm password',
      submit: 'Create an account',
      termsAgree: 'I agree to the',
      termsLink: 'Terms and Conditions',
      termsAnd: 'and the',
      privacyLink: 'Privacy Policy',
      orLogInWith: 'Or log in with',
      alreadyRegistered: 'Already registered?',
      logIn: 'Log in',
    },
    completeAccount: {
      title: 'Complete your account',
      subtitle: 'Choose a username and confirm your birthday.',
      usernamePlaceholder: 'Username',
      birthdayPlaceholder: 'Birthday (DD/MM/YYYY)',
      signOut: 'Sign out',
      sessionExpired: 'Session expired. Please sign in again.',
      unexpectedError: 'An unexpected error occurred',
    },
    onboarding: {
      placeholderTitle: 'Almost there!',
      placeholderSubtitle:
        'Complete your profile to start using DOUMASSI.\nThe full onboarding flow is coming soon.',
      continueToFeed: 'Skip for now',
    },
    coverPhoto: {
      title: 'Add a cover photo',
      subtitle: 'Personalize your profile with a banner image.',
      hint: 'Tap to add a cover photo.\nWe recommend a wide image (1500×500px).',
      changeHint: 'Tap to change',
      takePhoto: 'Take a photo',
      chooseFromGallery: 'Choose from gallery',
      finishSetup: 'Finish setup',
      skipForNow: 'Skip for now',
      errorGeneric: 'An unexpected error occurred',
      selectedA11y: 'Cover photo selected',
    },
    settings: {
      title: 'Settings',
      logoutSection: 'Account',
      logoutButton: 'Sign out',
      logoutConfirmTitle: 'Sign out?',
      logoutConfirmMessage: 'You will be signed out of your DOUMASSI account on this device.',
      logoutConfirmCancel: 'Cancel',
      logoutConfirmAction: 'Sign out',
    },
    google: {
      continueWithGoogle: 'Continue with Google',
      callbackInProgress: 'Signing you in…',
      callbackError: 'Google sign-in failed. Please try again.',
    },
    forgotPassword: {
      title: 'Forgot your\npassword?',
      subtitle:
        'No worries! Enter your email address and we’ll send you instructions to reset your password.',
      emailPlaceholder: 'Email address',
      submit: 'Send reset instructions',
      backToLogin: 'Back to login',
      successMessage:
        'If an account exists for this address, a reset email has just been sent. Check your spam folder if you don’t see it.',
    },
    resetPassword: {
      title: 'Set a new\npassword',
      subtitle: 'Choose a new password to finalize the reset.',
      passwordPlaceholder: 'New password',
      confirmPlaceholder: 'Confirm password',
      submit: 'Update password',
      successMessage: 'Password updated. You can now log in.',
      invalidLink:
        'This reset link is invalid or has expired. Request a new one from the login screen.',
    },
    errors: {
      weakPassword: 'Password is too weak (8 characters minimum).',
      samePassword: 'New password must be different from the previous one.',
      emailAlreadyUsed: 'An account with this email already exists. Try logging in instead.',
      invalidCredentials: 'Wrong email/phone or password.',
      emailNotConfirmed: 'Please confirm your email before logging in.',
      invalidIdentifier: 'Enter a valid email or phone number.',
      rateLimit: 'Too many attempts. Please try again in a few minutes.',
      invalidEmail: 'Invalid email address.',
      userNotFound: 'No account matches this email address.',
      expiredLink: 'Link expired. Please request a new reset email.',
      network: 'Network issue. Check your connection and try again.',
      unknown: 'An unexpected error occurred. Please try again.',
    },
    pendingDeletion: {
      title: 'Deletion scheduled',
      bodyPrefix:
        'You requested the deletion of your account. Without action, it will be permanently deleted on ',
      daysLeft: (n: number) => ` (in ${n} day${n > 1 ? 's' : ''})`,
      cancelPending: 'Cancelling…',
      cancelButton: 'Cancel the request',
      cancelA11y: 'Cancel the deletion request',
      manageButton: 'Manage in settings',
      manageA11y: 'Open account settings',
      laterButton: 'Later',
      laterA11y: 'Close and continue',
      cancelledTitle: 'Deletion cancelled',
      cancelledMessage:
        'Welcome back! Your account is kept. You can request deletion again anytime from Settings.',
      errorTitle: 'Error',
      errorFallback: 'Could not cancel right now. Please try again.',
    },
    exportData: {
      dialogTitle: 'Export my DOUMASSI data',
      sessionExpired: 'Session expired. Please sign in again and retry.',
      failed: 'The export failed. Please try again in a moment.',
    },
    validation: {
      identifierRequired: 'Identifier is required',
      invalidIdentifier: 'Enter a valid email or phone number',
      passwordMinLength: 'Password must be at least 8 characters',
      fullNameMinLength: 'Full name must be at least 2 characters',
      fullNameMaxLength: 'Full name cannot exceed 100 characters',
      bioMaxLength: 'Bio cannot exceed 250 characters',
      emailRequired: 'Email is required',
      invalidEmail: 'Invalid email address',
      birthdayRequired: 'Birthday is required',
      invalidDate: 'Invalid date (expected format: DD/MM/YYYY)',
      passwordUppercase: 'Password must contain at least one uppercase letter',
      passwordDigit: 'Password must contain at least one number',
      confirmPasswordRequired: 'Please confirm your password',
      confirmationRequired: 'Confirmation required',
      mustAcceptTerms: 'You must accept the Terms and Conditions',
      passwordsDoNotMatch: 'Passwords do not match',
      usernameMinLength: 'Username must be at least 3 characters',
      usernameMaxLength: 'Username cannot exceed 30 characters',
      usernameFormat:
        'Username must start with a letter and contain only letters, numbers and underscores',
      usernameNoTrailingUnderscore: 'Username cannot end with an underscore',
      usernameFormatReserved: 'This username format is reserved',
      usernameReserved: 'This username is reserved',
    },
  },
  profile: {
    stats: {
      posts: 'Posts',
      followers: 'Followers',
      following: 'Following',
    },
    editButton: 'Edit',
    shareButton: 'Share',
    shareMessage: 'Check out my profile on DOUMASSI! 🚀',
    verifiedBadge: 'Verified',
    kebabMenu: {
      settings: 'Settings',
      shareProfile: 'Share my profile',
      cancel: 'Cancel',
    },
    tabs: {
      grid: 'Grid',
      reels: 'Reels',
      tagged: 'Tagged',
    },
    emptyState: {
      title: 'No posts yet',
    },
  },
  settings: {
    languageTitle: 'Language',
    languageSubtitle: 'Choose the app language',
    languageFr: 'Français',
    languageEn: 'English',
  },
  feed: feedEn,
  profileScreens: profileScreensEn,
  messaging: messagingEn,
  notifications: notificationsEn,
  marketplace: marketplaceEn,
  cours: coursEn,
  games: gamesEn,
  common: commonEn,
  wallet: walletEn,
};
