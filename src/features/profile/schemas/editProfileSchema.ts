import { z } from 'zod';

import { createUsernameSchema } from '@/features/auth/schemas/usernameRules';
import type { AuthValidation } from '@/i18n';

export const createEditProfileSchema = (v: AuthValidation) =>
  z.object({
    fullName: z.string().trim().min(2, v.fullNameMinLength).max(100, v.fullNameMaxLength),
    username: createUsernameSchema(v),
    bio: z.string().max(250, v.bioMaxLength),
    isProfessional: z.boolean(),
  });

export type EditProfileFormValues = z.infer<ReturnType<typeof createEditProfileSchema>>;
