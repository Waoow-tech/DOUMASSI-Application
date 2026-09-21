// useWebSearch — E5-17 (Recherche web).
//
// Appelle l'Edge Function ai-web-search (auth + quota + Tavily côté serveur) et
// renvoie la synthèse + les sources citées. Expose `quota_exceeded` pour un
// message dédié. Pattern calqué sur useTranslate.

import { useMutation } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface WebSearchSource {
  title: string;
  url: string;
}

export interface WebSearchResult {
  answer: string;
  sources: WebSearchSource[];
}

interface WebSearchResponse {
  answer?: string;
  sources?: WebSearchSource[];
  error?: string;
}

async function webSearch(query: string): Promise<WebSearchResult> {
  const { data, error } = await supabase.functions.invoke<WebSearchResponse>('ai-web-search', {
    body: { query },
  });

  if (error) {
    let code = 'search_failed';
    try {
      const ctx = (error as { context?: { json?: () => Promise<WebSearchResponse> } }).context;
      const bodyErr = await ctx?.json?.();
      if (bodyErr?.error) code = bodyErr.error;
    } catch {
      // corps illisible → code générique
    }
    throw new Error(code);
  }

  return {
    answer: data?.answer ?? '',
    sources: data?.sources ?? [],
  };
}

export function useWebSearch() {
  return useMutation({
    mutationFn: webSearch,
    onError: (err) => logger.warn('web_search_failed', { message: (err as Error).message }),
  });
}
