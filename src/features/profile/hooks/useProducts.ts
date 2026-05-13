// Hook de données produits — E3-VENDOR.
// Récupère les produits d'un user depuis la table `products`.
// Utilise TanStack Query pour le cache et le refetch automatique.

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ProductItem {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  product_url: string | null;
}

async function fetchProductsByUserId(userId: string): Promise<ProductItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, price, image_url, product_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Erreur fetch products', { userId, message: error.message });
    throw error;
  }

  return (data ?? []) as ProductItem[];
}

export function useProducts(userId: string | null) {
  return useQuery({
    queryKey: ['profile', 'products', userId],
    queryFn: () => fetchProductsByUserId(userId as string),
    enabled: userId !== null,
  });
}
