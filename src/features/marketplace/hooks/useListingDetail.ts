// useListingDetail + useSimilarListings — E7-12 (Fiche produit + similaires)
//
// La RPC get_listing_detail incrémente le view_count à chaque appel côté DB.
// Pour éviter de spammer le compteur en cas de re-render ou de refetch
// agressif, on garde un staleTime modéré (60s) et on désactive le
// refetchOnWindowFocus / refetchOnMount.

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ListingBadge, ListingCategory, ListingCondition } from './useListings';

export interface ListingDetail {
  id: string;
  seller_id: string;
  seller_username: string;
  seller_full_name: string | null;
  seller_avatar_url: string | null;
  seller_is_verified: boolean;
  category: ListingCategory;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  images: string[];
  location: string | null;
  condition: ListingCondition | null;
  badge: ListingBadge | null;
  discount_percent: number | null;
  view_count: number;
  created_at: string;
  bookmarked_by_me: boolean;
}

export interface SimilarListing {
  id: string;
  title: string;
  price_cents: number | null;
  currency: string;
  images: string[];
  badge: ListingBadge | null;
  discount_percent: number | null;
}

type RpcRow = Record<string, unknown>;

function isCategory(value: unknown): value is ListingCategory {
  return value === 'product' || value === 'service';
}

function isCondition(value: unknown): value is ListingCondition {
  return (
    value === 'neuf' || value === 'tres_bon_etat' || value === 'bon_etat' || value === 'occasion'
  );
}

function isBadge(value: unknown): value is ListingBadge {
  return value === 'offre_speciale' || value === 'nouveaute' || value === 'recommandation';
}

function mapDetail(row: RpcRow): ListingDetail {
  return {
    id: String(row.id ?? ''),
    seller_id: String(row.seller_id ?? ''),
    seller_username: String(row.seller_username ?? ''),
    seller_full_name: (row.seller_full_name as string | null) ?? null,
    seller_avatar_url: (row.seller_avatar_url as string | null) ?? null,
    seller_is_verified: Boolean(row.seller_is_verified ?? false),
    category: isCategory(row.category) ? row.category : 'product',
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    price_cents: typeof row.price_cents === 'number' ? row.price_cents : null,
    currency: String(row.currency ?? 'EUR'),
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    location: (row.location as string | null) ?? null,
    condition: isCondition(row.condition) ? row.condition : null,
    badge: isBadge(row.badge) ? row.badge : null,
    discount_percent: typeof row.discount_percent === 'number' ? row.discount_percent : null,
    view_count: typeof row.view_count === 'number' ? row.view_count : 0,
    created_at: String(row.created_at ?? ''),
    bookmarked_by_me: Boolean(row.bookmarked_by_me ?? false),
  };
}

export function listingDetailQueryKey(listingId: string) {
  return ['marketplace', 'detail', listingId] as const;
}

export function useListingDetail(listingId: string | null) {
  return useQuery({
    queryKey: listingId ? listingDetailQueryKey(listingId) : ['marketplace', 'detail', 'none'],
    enabled: Boolean(listingId),
    queryFn: async (): Promise<ListingDetail | null> => {
      if (!listingId) return null;
      const { data, error } = await supabase.rpc('get_listing_detail', {
        p_listing_id: listingId,
      });
      if (error) {
        logger.warn('get_listing_detail failed', { message: error.message, listingId });
        throw error;
      }
      // La RPC retourne TABLE (set), Supabase enveloppe en array. On prend la
      // 1ère row, ou null si l'annonce est inactive/inexistante.
      const rows = (data ?? []) as RpcRow[];
      const first = rows[0];
      return first ? mapDetail(first) : null;
    },
    // 60s : on évite que view_count se re-incrémente trop souvent.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

function mapSimilar(row: RpcRow): SimilarListing {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    price_cents: typeof row.price_cents === 'number' ? row.price_cents : null,
    currency: String(row.currency ?? 'EUR'),
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    badge: isBadge(row.badge) ? row.badge : null,
    discount_percent: typeof row.discount_percent === 'number' ? row.discount_percent : null,
  };
}

export function useSimilarListings(listingId: string | null, limit = 4) {
  const query = useQuery({
    queryKey: listingId
      ? ['marketplace', 'similar', listingId, limit]
      : ['marketplace', 'similar', 'none'],
    enabled: Boolean(listingId),
    queryFn: async (): Promise<SimilarListing[]> => {
      if (!listingId) return [];
      const { data, error } = await supabase.rpc('get_similar_listings', {
        p_listing_id: listingId,
        p_limit: limit,
      });
      if (error) {
        logger.warn('get_similar_listings failed', {
          message: error.message,
          listingId,
        });
        throw error;
      }
      return ((data ?? []) as RpcRow[]).map(mapSimilar);
    },
    staleTime: 5 * 60_000,
  });

  return useMemo(
    () => ({
      listings: query.data ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
    }),
    [query.data, query.isError, query.isLoading]
  );
}
