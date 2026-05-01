// Strings de l'app — locale provisoire MVP.
// Le projet est intitulé `fr.ts` pour anticiper l'i18n Sprint 2,
// mais les textes restent en anglais tant que la copy product n'est pas figée.

export const fr = {
  splash: {
    tagline: 'DOUMASSI',
  },
  auth: {
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
      submit: 'Send Reset Instructions',
      backToLogin: 'Back to Login',
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
      // Password / signup
      weakPassword: 'Password is too weak (8 characters minimum).',
      samePassword: 'New password must be different from the previous one.',
      emailAlreadyUsed: 'An account with this email already exists. Try logging in instead.',
      // Login
      invalidCredentials: 'Wrong email/phone or password.',
      emailNotConfirmed: 'Please confirm your email before logging in.',
      invalidIdentifier: 'Enter a valid email or phone number.',
      // Password / signup
      weakPassword: 'Password is too weak (8 characters minimum).',
      samePassword: 'New password must be different from the previous one.',
      // Email / rate limit
      rateLimit: 'Too many attempts. Please try again in a few minutes.',
      invalidEmail: 'Invalid email address.',
      userNotFound: 'No account matches this email address.',
      // Expired link
      expiredLink: 'Link expired. Please request a new reset email.',
      // Network / fallback
      network: 'Network issue. Check your connection and try again.',
      unknown: 'An unexpected error occurred. Please try again.',
    },
  },
} as const;

export type Translations = typeof fr;
