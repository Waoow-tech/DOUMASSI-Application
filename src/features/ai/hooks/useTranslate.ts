// useTranslate — E5-18 (Tools > Traducteur).
//
// Appelle l'Edge Function ai-translate (auth + quota partagé côté serveur) et
// renvoie la traduction. Expose le code `quota_exceeded` pour un message dédié.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface TranslateInput {
  text: string;
  targetLang: string;
}

interface TranslateResponse {
  translation?: string;
  error?: string;
}

async function translate({ text, targetLang }: TranslateInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke<TranslateResponse>('ai-translate', {
    body: { text, target_lang: targetLang },
  });

  if (error) {
    // supabase-js met la Response d'erreur dans error.context → on en extrait le
    // code (ex. `quota_exceeded`) pour un message précis côté UI.
    let code = 'translate_failed';
    try {
      const ctx = (error as { context?: { json?: () => Promise<TranslateResponse> } }).context;
      const bodyErr = await ctx?.json?.();
      if (bodyErr?.error) code = bodyErr.error;
    } catch {
      // corps illisible → code générique
    }
    throw new Error(code);
  }

  if (!data?.translation) {
    throw new Error(data?.error ?? 'translate_failed');
  }
  return data.translation;
}

export function useTranslate() {
  return useMutation({
    mutationFn: translate,
    onError: (err) => logger.warn('translate_failed', { message: (err as Error).message }),
  });
}
