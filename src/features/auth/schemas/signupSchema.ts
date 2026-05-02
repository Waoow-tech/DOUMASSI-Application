// Validation schema for the multi-step signup form.
// All error messages in English (consistent with UI language).
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { z } from 'zod';

/**
 * Zod schema — 2 steps.
 *
 * Step 1: fullName, username, email, birthday, password, confirmPassword
 * Step 2 (skippable): bio, gender, isProfessional
 *
 * Birthday format in input: DD/MM/YYYY.
 * Conversion to ISO (YYYY-MM-DD) happens in the hook before Supabase call.
 */
export const signupSchema = z
  .object({
    // --- Step 1 ---
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),

    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),

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

    // --- Step 2 (all have defaults — step is skippable) ---
    bio: z.string().max(250, 'Bio cannot exceed 250 characters'),

    gender: z.enum(['male', 'female', 'other', '']),

    isProfessional: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

/**
 * Step 1 field names — used by `form.trigger()`
 * to validate only step 1 before transitioning.
 */
export const STEP_1_FIELDS: (keyof SignupFormValues)[] = [
  'fullName',
  'username',
  'email',
  'birthday',
  'password',
  'confirmPassword',
];
