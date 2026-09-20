// contactSchema — E8-03
//
// Schéma de validation du formulaire de contact. Factory recevant les messages
// i18n (convention du repo, cf. createSignupSchema / createChangePasswordSchema).
// Champs obligatoires : nom, e-mail, sujet, message. Téléphone et entreprise
// sont optionnels.

import { z } from 'zod';

import type { ContactTranslations } from '@/i18n/fr/contact';

export function createContactSchema(v: ContactTranslations['validation']) {
  return z.object({
    name: z.string().trim().min(1, v.nameRequired).max(120),
    email: z.string().trim().min(1, v.emailRequired).email(v.invalidEmail).max(200),
    phone: z.string().trim().max(40).optional(),
    company: z.string().trim().max(160).optional(),
    subject: z.string().trim().min(1, v.subjectRequired).max(160),
    message: z.string().trim().min(1, v.messageRequired).min(10, v.messageTooShort).max(5000),
  });
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactSchema>>;
