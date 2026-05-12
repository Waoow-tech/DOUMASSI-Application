// Validation schema for the signup form (single page).
// All error messages in English (consistent with UI language).
//
// Refactor E2-02b : retiré bio, gender, isProfessional, STEP_1_FIELDS
// (ces champs vivent maintenant dans l'onboarding, pas dans le signup).
// Le signup garde juste les champs essentiels à la création de compte
// + username (pour vérifier l'unicité au moment de l'inscription).
//
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { z } from 'zod';

import { usernameSchema } from './usernameRules';

export const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),

    username: usernameSchema,

    email: z.string().min(1, 'Email is required').email('Invalid email address'),

    birthday: z
      .string()
      .min(1, 'Birthday is required')
      .refine((val) => {
        const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match?.[1] || !match[2] || !match[3]) return false;
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const date = new Date(year, month - 1, day);
        return (
          date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        );
      }, 'Invalid date (expected format: DD/MM/YYYY)'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),

    confirmPassword: z.string().min(1, 'Please confirm your password'),

    acceptedTerms: z.literal(true, {
      error: 'You must accept the Terms and Conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

export type SignupFormInput = Omit<SignupFormValues, 'acceptedTerms'> & {
  acceptedTerms: boolean;
};
