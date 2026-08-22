import { z } from 'zod';

import type { AuthValidation } from '@/i18n';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\+?\d{8,15}$/;

export function normalizePhoneIdentifier(identifier: string) {
  return identifier.trim().replace(/[\s().-]/g, '');
}

export function getLoginIdentifierType(identifier: string) {
  const trimmedIdentifier = identifier.trim();

  if (EMAIL_REGEX.test(trimmedIdentifier.toLowerCase())) {
    return 'email';
  }

  if (PHONE_REGEX.test(normalizePhoneIdentifier(trimmedIdentifier))) {
    return 'phone';
  }

  return null;
}

export const createLoginSchema = (v: AuthValidation) =>
  z.object({
    identifier: z
      .string()
      .trim()
      .min(3, v.identifierRequired)
      .refine((value) => getLoginIdentifierType(value) !== null, {
        message: v.invalidIdentifier,
      }),
    password: z.string().min(8, v.passwordMinLength),
  });

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
