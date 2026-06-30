// useBookmarkedListings — E7-16 (#247)
//
// Pattern useInfiniteQuery sur la RPC get_my_bookmarked_listings. La RPC
// retourne déjà bookmarked_by_me=true sur toutes les rows ; on garde le
// flag pour que ListingCard affiche le bookmark plein.
//
// QueryKey distincte de la grille : ['marketplace', 'bookmarks'] — c'est
// celle invalidée par useToggleListingBookmark.onSettled. Si l'user
// retire un favori depuis la grille, cet écran refetch.

import { useInfiniteQuery } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import type { ListingCard } from './useListings';

const PAGE_SIZE = 20;

type RpcRow = Record<string, unknown>;

function isCategory(value: unknown): value is ListingCard['category'] {
  return value === 'product' || value === 'service';
}

function isCondition(value: unknown): value is NonNullable<ListingCard['condition']> {
  return (
    value === 'neuf' || value === 'tres_bon_etat' || value === 'bon_etat' || value === 'occasion'
  );
}

function isBadge(value: unknown): value is NonNullable<ListingCard['badge']> {
  return value === 'offre_speciale' || value === 'nouveaute' || value === 'recommandation';
}

function mapRow(row: RpcRow): ListingCard {
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
    bookmarked_by_me: true,
  };
}

async function fetchBookmarksPage(cursor: string | null) {
  const { data, error } = await supabase.rpc('get_my_bookmarked_listings', {
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });
  if (error) {
    logger.warn('get_my_bookmarked_listings failed', { message: error.message });
    throw error;
  }
  const rows = (data ?? []) as RpcRow[];
  const listings = rows.map(mapRow);
  // Cursor = bookmarked_at de la DERNIÈRE row (la RPC trie par lb.created_at
  // desc — exposé en `bookmarked_at`). Cohérent avec le ORDER BY côté DB.
  const lastBookmarkedAt = rows[rows.length - 1]?.bookmarked_at;
  const nextCursor =
    listings.length === PAGE_SIZE && typeof lastBookmarkedAt === 'string' ? lastBookmarkedAt : null;
  return { listings, nextCursor };
}

export function useBookmarkedListings() {
  return useInfiniteQuery({
    queryKey: ['marketplace', 'bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarksPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}
