// Validation Zod partagée pour le champ `username`.
// Utilisée par signupSchema et completeAccountSchema pour garder une seule
// source de vérité sur les règles d'unicité, format et noms réservés.
//
// Règles :
//   1. Longueur : 3 à 30 caractères
//   2. Format : ^[a-zA-Z][a-zA-Z0-9_]*$ — commence par une lettre, puis lettres/chiffres/underscores
//   3. Ne se termine pas par un underscore (cosmétique, plus propre)
//   4. Ne matche pas le pattern temporaire `user_[0-9a-f]{8}` réservé par
//      le trigger Supabase pour les users Google OAuth fresh (sinon le guard
//      les renverrait en boucle vers /complete-account)
//   5. N'est pas dans la liste des noms réservés (admin, support, etc.)
//
// La vérification d'unicité en BDD est faite séparément via la RPC
// `is_username_available` (hook useUsernameAvailability).
//
// Pour defense-in-depth, la même blacklist devrait être appliquée côté
// Supabase dans la RPC ou via un trigger. Voir prompt dans la PR.

import { z } from 'zod';

import type { AuthValidation } from '@/i18n';

/** Pattern temporaire généré par le trigger Supabase pour les users Google. */
export const TEMP_USERNAME_PATTERN = /^user_[0-9a-f]{8}$/;

/**
 * Noms réservés interdits (case-insensitive). Couvre :
 * - Comptes système / admin
 * - Termes susceptibles de phishing (`support_official` etc.)
 * - Termes brand DOUMASSI
 * - Valeurs techniques courantes (null, undefined, etc.)
 *
 * À étendre si besoin futur. Cette liste vit ici pour rester accessible
 * côté client. La RPC Supabase doit avoir la même liste pour defense-in-depth.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Système / admin
  'admin',
  'administrator',
  'root',
  'sudo',
  'system',
  'staff',
  'moderator',
  'mod',
  // Support / help
  'support',
  'helpdesk',
  'help',
  'contact',
  'feedback',
  'abuse',
  'report',
  // API / technique
  'api',
  'app',
  'www',
  'mail',
  'email',
  'null',
  'undefined',
  'true',
  'false',
  'anonymous',
  'deleted',
  // Brand
  'doumassi',
  'doumassiapp',
  'doumassi_app',
  'doumassi_official',
  'doumassi_team',
  'official',
  'team',
  // Personnages publics / rôles
  'ceo',
  'founder',
  'owner',
  'me',
  'you',
  'user',
  'users',
  'guest',
]);

/**
 * Fabrique du schéma Zod partagé pour valider un username.
 * Réutilisée par createSignupSchema et createCompleteAccountSchema.
 * Paramétrée par les messages i18n (`t.auth.validation`) pour suivre la langue.
 */
export const createUsernameSchema = (v: AuthValidation) =>
  z
    .string()
    .min(3, v.usernameMinLength)
    .max(30, v.usernameMaxLength)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, v.usernameFormat)
    .refine((val) => !val.endsWith('_'), {
      message: v.usernameNoTrailingUnderscore,
    })
    .refine((val) => !TEMP_USERNAME_PATTERN.test(val), {
      message: v.usernameFormatReserved,
    })
    .refine((val) => !RESERVED_USERNAMES.has(val.toLowerCase()), {
      message: v.usernameReserved,
    });
