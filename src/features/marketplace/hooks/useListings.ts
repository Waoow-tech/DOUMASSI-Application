// useListings — E7-10 — Grille Marketplace paginée
//
// Pattern strictement aligné sur useFeed.ts (Sprint 3) — useInfiniteQuery +
// cursor sur created_at, RPC SECURITY DEFINER + JOIN profile vendeur côté DB.
//
// La RPC get_listings (Sprint 7, migration 20260629180000) est grantée à
// anon + authenticated → la marketplace est visible sans compte. `bookmarked_by_me`
// reste null/false pour les visiteurs anon.

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

export type ListingCategory = 'product' | 'service';
export type ListingCondition = 'neuf' | 'tres_bon_etat' | 'bon_etat' | 'occasion';
export type ListingSort = 'recent' | 'price_asc' | 'price_desc' | 'popular';
export type ListingBadge = 'offre_speciale' | 'nouveaute' | 'recommandation';

export interface ListingCard {
  id: string;
  seller_id: string;
  seller_username: string;
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

export interface ListingsFilters {
  category?: ListingCategory | null;
  condition?: ListingCondition | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  sort?: ListingSort;
}

type ListingsRpcRow = Record<string, unknown>;

type ListingsQueryData = {
  pages: { listings: ListingCard[]; nextCursor: string | null }[];
  pageParams: unknown[];
};

export function listingsQueryKey(filters: ListingsFilters) {
  return [
    'marketplace',
    'listings',
    {
      category: filters.category ?? null,
      condition: filters.condition ?? null,
      minPriceCents: filters.minPriceCents ?? null,
      maxPriceCents: filters.maxPriceCents ?? null,
      sort: filters.sort ?? 'recent',
    },
  ] as const;
}

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

function mapRowToCard(row: ListingsRpcRow): ListingCard {
  return {
    id: String(row.id ?? ''),
    seller_id: String(row.seller_id ?? ''),
    seller_username: String(row.seller_username ?? ''),
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

async function fetchListingsPage(cursor: string | null, filters: ListingsFilters) {
  const { data, error } = await supabase.rpc('get_listings', {
    p_category: filters.category ?? null,
    p_condition: filters.condition ?? null,
    p_min_price_cents: filters.minPriceCents ?? null,
    p_max_price_cents: filters.maxPriceCents ?? null,
    p_sort: filters.sort ?? 'recent',
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    logger.warn('get_listings failed', { message: error.message });
    throw error;
  }

  const listings = ((data ?? []) as ListingsRpcRow[]).map(mapRowToCard);
  // Cursor = created_at de la dernière row si la page est pleine, null sinon.
  // Note : pour sort != 'recent', le cursor reste sur created_at — la pagination
  // est cohérente côté DB (cf ORDER BY ... l.created_at desc final dans la RPC).
  const nextCursor =
    listings.length === PAGE_SIZE ? (listings[listings.length - 1]?.created_at ?? null) : null;

  return { listings, nextCursor };
}

export function useListings(filters: ListingsFilters = {}) {
  return useInfiniteQuery({
    queryKey: listingsQueryKey(filters),
    queryFn: ({ pageParam }) => fetchListingsPage(pageParam, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

/**
 * Toggle bookmark optimiste + invalidation des queries marketplace.
 * Utilise la RPC toggle_listing_bookmark (authenticated only).
 */
export function useToggleListingBookmark() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { listingId: string }>({
    mutationFn: async ({ listingId }) => {
      const { data, error } = await supabase.rpc('toggle_listing_bookmark', {
        p_listing_id: listingId,
      });
      if (error) {
        logger.warn('toggle_listing_bookmark failed', {
          message: error.message,
          listingId,
        });
        throw error;
      }
      // RPC retourne le NOUVEL état (true = bookmarked, false = unbookmarked).
      return Boolean(data);
    },
    onMutate: async ({ listingId }) => {
      // Optimistic : flip bookmarked_by_me sur toutes les pages cachées des
      // queries marketplace (filtres confondus).
      await queryClient.cancelQueries({ queryKey: ['marketplace', 'listings'] });
      queryClient.setQueriesData<ListingsQueryData>(
        { queryKey: ['marketplace', 'listings'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              listings: page.listings.map((l) =>
                l.id === listingId ? { ...l, bookmarked_by_me: !l.bookmarked_by_me } : l
              ),
            })),
          };
        }
      );
    },
    onError: (_err, vars) => {
      // Reverse l'optimistic en cas d'échec.
      queryClient.setQueriesData<ListingsQueryData>(
        { queryKey: ['marketplace', 'listings'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              listings: page.listings.map((l) =>
                l.id === vars.listingId ? { ...l, bookmarked_by_me: !l.bookmarked_by_me } : l
              ),
            })),
          };
        }
      );
    },
    onSettled: () => {
      // Refetch les bookmarks-only view (E7-16) qui pourrait diverger.
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'bookmarks'] });
    },
  });
}
