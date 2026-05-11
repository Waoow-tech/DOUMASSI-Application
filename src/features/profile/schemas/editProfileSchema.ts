import { z } from 'zod';

import { usernameSchema } from '@/features/auth/schemas/usernameRules';

export const editProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  displayName: z
    .string()
    .trim()
    .max(100, 'Display name cannot exceed 100 characters')
    .refine((value) => value.length === 0 || value.length >= 2, {
      message: 'Display name must be at least 2 characters',
    }),
  username: usernameSchema,
  bio: z.string().max(250, 'Bio cannot exceed 250 characters'),
  isProfessional: z.boolean(),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
