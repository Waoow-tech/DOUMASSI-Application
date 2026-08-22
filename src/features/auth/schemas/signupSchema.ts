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

import type { AuthValidation } from '@/i18n';

import { isAtLeastMinAge } from '../lib/age';

import { createUsernameSchema } from './usernameRules';

export const createSignupSchema = (v: AuthValidation) =>
  z
    .object({
      fullName: z.string().min(2, v.fullNameMinLength),

      username: createUsernameSchema(v),

      email: z.string().min(1, v.emailRequired).email(v.invalidEmail),

      birthday: z
        .string()
        .min(1, v.birthdayRequired)
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
        }, v.invalidDate)
        // Âge minimum 15 ans (ADR-008 §2.2). Confort UX : la règle est réellement
        // appliquée côté serveur par le trigger enforce_min_age sur profiles.
        .refine(isAtLeastMinAge, v.minAge),

      password: z
        .string()
        .min(8, v.passwordMinLength)
        .regex(/[A-Z]/, v.passwordUppercase)
        .regex(/[0-9]/, v.passwordDigit),

      confirmPassword: z.string().min(1, v.confirmPasswordRequired),

      acceptedTerms: z.literal(true, {
        error: v.mustAcceptTerms,
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: v.passwordsDoNotMatch,
      path: ['confirmPassword'],
    });

export type SignupFormValues = z.infer<ReturnType<typeof createSignupSchema>>;

export type SignupFormInput = Omit<SignupFormValues, 'acceptedTerms'> & {
  acceptedTerms: boolean;
};
