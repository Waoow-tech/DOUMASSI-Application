// Validation runtime des variables d'environnement.
// Les vars Supabase sont obligatoires (l'app ne peut pas tourner sans).
// Les vars Sentry/PostHog sont optionnelles : si absentes, le monitoring
// est désactivé silencieusement (utile en dev).

import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url('EXPO_PUBLIC_SUPABASE_URL doit être une URL valide'),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY est requise'),
  EXPO_PUBLIC_SENTRY_DSN: z.url().optional().or(z.literal('')),
  EXPO_PUBLIC_POSTHOG_KEY: z.string().optional().or(z.literal('')),
  EXPO_PUBLIC_POSTHOG_HOST: z.url().optional().default('https://eu.i.posthog.com'),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
});

if (!parsed.success) {
  throw new Error(
    `Variables d'environnement invalides ou manquantes :\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}\n\nVérifier .env.local (s'inspirer de .env.example).`
  );
}

// Normalise les chaînes vides en undefined pour faciliter les checks "if (env.X)"
const data = parsed.data;
export const env = {
  EXPO_PUBLIC_SUPABASE_URL: data.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: data.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SENTRY_DSN: data.EXPO_PUBLIC_SENTRY_DSN || undefined,
  EXPO_PUBLIC_POSTHOG_KEY: data.EXPO_PUBLIC_POSTHOG_KEY || undefined,
  EXPO_PUBLIC_POSTHOG_HOST: data.EXPO_PUBLIC_POSTHOG_HOST,
};
