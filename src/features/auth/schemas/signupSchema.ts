// Schéma de validation pour le formulaire d'inscription multi-étapes.
// Messages d'erreur strictement en français.
// Ticket E2-02 — Sprint 1 Auth & Onboarding.

import { z } from 'zod';

/**
 * Schéma Zod pour l'inscription — 2 étapes.
 *
 * Étape 1 : fullName, username, email, birthday, password
 * Étape 2 : bio (optionnel), isProfessional
 *
 * Le format birthday attendu en saisie est JJ/MM/AAAA.
 * La conversion vers ISO (YYYY-MM-DD) se fait dans le hook avant l'envoi Supabase.
 */
export const signupSchema = z.object({
  // --- Étape 1 ---
  fullName: z.string().min(2, 'Le nom complet doit contenir au moins 2 caractères'),

  username: z
    .string()
    .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
    .max(30, "Le nom d'utilisateur ne peut pas dépasser 30 caractères")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores"
    ),

  email: z.string().min(1, "L'email est requis").email('Email invalide'),

  birthday: z
    .string()
    .min(1, 'La date de naissance est requise')
    .refine((val) => {
      // Valide le format JJ/MM/AAAA et que la date existe réellement
      const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match?.[1] || !match[2] || !match[3]) return false;
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }, 'Date de naissance invalide (format attendu : JJ/MM/AAAA)'),

  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),

  // --- Étape 2 ---
  bio: z.string().max(250, 'La bio ne peut pas dépasser 250 caractères'),

  isProfessional: z.boolean(),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

/**
 * Noms des champs de l'étape 1 — utilisés par `form.trigger()`
 * pour valider uniquement la première étape avant transition.
 */
export const STEP_1_FIELDS: (keyof SignupFormValues)[] = [
  'fullName',
  'username',
  'email',
  'birthday',
  'password',
];
