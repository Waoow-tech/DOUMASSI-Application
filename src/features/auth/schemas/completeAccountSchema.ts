// Zod schema for the Google complete-account form.
// Only two fields: username and birthday — the minimum data
// needed before proceeding to the profile onboarding steps.
//
// Ticket E2-14 — Sprint 1 Auth & Onboarding.

import { z } from 'zod';

import type { AuthValidation } from '@/i18n';

import { isAtLeastMinAge } from '../lib/age';

import { createUsernameSchema } from './usernameRules';

export const createCompleteAccountSchema = (v: AuthValidation) =>
  z.object({
    username: createUsernameSchema(v),

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
      // Âge minimum 15 ans (ADR-008 §2.2) — même règle que le signup classique.
      .refine(isAtLeastMinAge, v.minAge),
  });

export type CompleteAccountFormValues = z.infer<ReturnType<typeof createCompleteAccountSchema>>;
