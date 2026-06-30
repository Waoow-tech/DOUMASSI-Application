// useCreateListing — E7-14 (#245) — Création d'annonce
//
// Wrappe la RPC create_listing (security definer, seller_id forcé à
// auth.uid() côté DB → impossible de créer une annonce pour un autre user).
//
// Hors-scope création utilisateur : badge et discount_percent ne sont pas
// dans la signature de la RPC — réservés à une éventuelle interface admin.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ListingCategory, ListingCondition } from './useListings';

export interface CreateListingInput {
  category: ListingCategory;
  title: string;
  description: string;
  price_cents: number;
  currency?: string;
  images?: string[];
  location?: string | null;
  condition?: ListingCondition | null;
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateListingInput>({
    mutationFn: async (input): Promise<string> => {
      const { data, error } = await supabase.rpc('create_listing', {
        p_category: input.category,
        p_title: input.title,
        p_description: input.description,
        p_price_cents: input.price_cents,
        p_currency: input.currency ?? 'EUR',
        p_images: input.images ?? [],
        p_location: input.location ?? null,
        p_condition: input.condition ?? null,
      });
      if (error) {
        logger.warn('create_listing failed', {
          message: error.message,
          category: input.category,
        });
        throw error;
      }
      // La RPC retourne directement l'UUID en scalaire.
      return String(data);
    },
    onSuccess: () => {
      // Toutes les queries marketplace (grille + bookmarks) sont périmées.
      void queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}
