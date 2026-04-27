// Schéma de validation pour le formulaire de connexion.
// Utilise Zod pour valider l'identifiant (email ou téléphone) et le mot de passe.
// Ticket E2-01 — Sprint 1 Auth & Onboarding.

import { z } from 'zod';

/**
 * Schéma de validation pour le login.
 * - identifier : accepte un email ou un numéro de téléphone (min 3 caractères).
 * - password : min 8 caractères.
 */
export const loginSchema = z.object({
  identifier: z.string().min(3, 'Identifiant requis (min. 3 caractères)'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
