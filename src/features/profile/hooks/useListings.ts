// Hook de données des annonces (listings) — E3-VENDOR.
// Récupère les articles en vente d'un utilisateur depuis la table `listings`.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ListingItem {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  images: string[];
  is_active: boolean;
  badge: string | null;
  discount_percent: number | null;
}

async function fetchListingsByUserId(userId: string): Promise<ListingItem[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, seller_id, title, description, price_cents, currency, images, is_active, badge, discount_percent'
    )
    .eq('seller_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Erreur fetch listings', { userId, message: error.message });
    throw error;
  }

  return (data ?? []) as ListingItem[];
}

export function useListings(userId: string | null) {
  return useQuery({
    queryKey: ['profile', 'listings', userId],
    queryFn: () => fetchListingsByUserId(userId as string),
    enabled: userId !== null,
  });
}
