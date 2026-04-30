import { z } from 'zod';

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

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Identifiant requis')
    .refine((value) => getLoginIdentifierType(value) !== null, {
      message: 'Entrez un email ou un numéro de téléphone valide',
    }),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
