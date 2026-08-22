// useSuggestCaption — E5-14.
//
// Demande 3 suggestions de légende pour un post à partir de son image :
//   1. upload l'image dans le bucket privé ai-attachments (uploadAiImage)
//   2. appelle l'Edge Function ai-suggest-caption avec le path + le texte déjà saisi
//   3. renvoie les 3 légendes (l'UI en propose une à insérer)
//
// Quota partagé avec le chat (20/j) : la vérification est faite côté serveur.
// On expose le code d'erreur `quota_exceeded` pour un message dédié côté UI.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { uploadAiImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

interface SuggestCaptionInput {
  /** URI locale de l'image sélectionnée dans le composer. */
  imageUri: string;
  /** Texte déjà tapé par l'utilisateur (oriente le ton). */
  context: string;
}

interface SuggestCaptionResponse {
  suggestions?: string[];
  error?: string;
}

async function suggestCaption({ imageUri, context }: SuggestCaptionInput): Promise<string[]> {
  // 1. Upload dans le bucket privé (compression incluse). Renvoie un path.
  const { path } = await uploadAiImage(imageUri);

  // 2. Appel de l'Edge Function (auth + quota gérés côté serveur).
  const { data, error } = await supabase.functions.invoke<SuggestCaptionResponse>(
    'ai-suggest-caption',
    { body: { image_path: path, context } }
  );

  if (error) {
    // supabase-js met la Response d'erreur dans error.context : on tente d'en
    // extraire le code (ex. `quota_exceeded`) pour un message précis côté UI.
    let code = 'suggest_failed';
    try {
      const ctx = (error as { context?: { json?: () => Promise<SuggestCaptionResponse> } }).context;
      const bodyErr = await ctx?.json?.();
      if (bodyErr?.error) code = bodyErr.error;
    } catch {
      // corps illisible → on garde le code générique
    }
    throw new Error(code);
  }

  if (!data?.suggestions || data.suggestions.length === 0) {
    throw new Error(data?.error ?? 'suggest_failed');
  }

  return data.suggestions;
}

export function useSuggestCaption() {
  return useMutation({
    mutationFn: suggestCaption,
    onError: (err) => logger.warn('suggest_caption_failed', { message: (err as Error).message }),
  });
}
