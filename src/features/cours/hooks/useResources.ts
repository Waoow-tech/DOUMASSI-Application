// useResources — E9-04 — Grille des ressources pédagogiques
//
// Pattern strictement aligné sur useListings (marketplace) : useInfiniteQuery
// + cursor created_at + RPC get_resources security definer. La RPC est
// grantée anon + authenticated → la bibliothèque est consultable sans compte.

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;

export type ResourceType = 'cours' | 'fiche_revision' | 'exercices' | 'annale';
export type ResourceSort = 'recent' | 'popular';

// Ordre d'affichage des types de ressource. Les libellés UI sont dans le dico
// i18n (`t.cours.resourceType[type]`) — on ne garde ici que l'énumération.
export const RESOURCE_TYPES: readonly ResourceType[] = [
  'cours',
  'fiche_revision',
  'exercices',
  'annale',
];

export interface ResourceListItem {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  level_code: string;
  subject_code: string;
  type: ResourceType;
  title: string;
  description: string | null;
  files: string[];
  view_count: number;
  created_at: string;
  bookmarked_by_me: boolean;
}

export interface ResourcesFilters {
  levelCode?: string | null;
  subjectCode?: string | null;
  type?: ResourceType | null;
  search?: string | null;
  sort?: ResourceSort;
}

type RpcRow = Record<string, unknown>;

type ResourcesQueryData = {
  pages: { resources: ResourceListItem[]; nextCursor: string | null }[];
  pageParams: unknown[];
};

// Type minimal pour flipper le cache de la fiche détail sans importer
// ResourceDetail (éviterait un import circulaire avec useResourceDetail).
type BookmarkableDetail = { id: string; bookmarked_by_me: boolean };

export function resourcesQueryKey(filters: ResourcesFilters) {
  return [
    'cours',
    'resources',
    {
      levelCode: filters.levelCode ?? null,
      subjectCode: filters.subjectCode ?? null,
      type: filters.type ?? null,
      search: (filters.search ?? '').trim().toLowerCase(),
      sort: filters.sort ?? 'recent',
    },
  ] as const;
}

function isType(value: unknown): value is ResourceType {
  return (
    value === 'cours' || value === 'fiche_revision' || value === 'exercices' || value === 'annale'
  );
}

function mapRow(row: RpcRow): ResourceListItem {
  return {
    id: String(row.id ?? ''),
    author_id: String(row.author_id ?? ''),
    author_username: String(row.author_username ?? ''),
    author_avatar_url: (row.author_avatar_url as string | null) ?? null,
    author_is_verified: Boolean(row.author_is_verified ?? false),
    level_code: String(row.level_code ?? ''),
    subject_code: String(row.subject_code ?? ''),
    type: isType(row.type) ? row.type : 'cours',
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    files: Array.isArray(row.files) ? (row.files as string[]) : [],
    view_count: typeof row.view_count === 'number' ? row.view_count : 0,
    created_at: String(row.created_at ?? ''),
    bookmarked_by_me: Boolean(row.bookmarked_by_me ?? false),
  };
}

async function fetchResourcesPage(cursor: string | null, filters: ResourcesFilters) {
  const search = (filters.search ?? '').trim();
  const { data, error } = await supabase.rpc('get_resources', {
    p_level_code: filters.levelCode ?? null,
    p_subject_code: filters.subjectCode ?? null,
    p_type: filters.type ?? null,
    p_search: search.length > 0 ? search : null,
    p_sort: filters.sort ?? 'recent',
    p_cursor: cursor,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    logger.warn('get_resources failed', { message: error.message });
    throw error;
  }

  const resources = ((data ?? []) as RpcRow[]).map(mapRow);
  const nextCursor =
    resources.length === PAGE_SIZE ? (resources[resources.length - 1]?.created_at ?? null) : null;

  return { resources, nextCursor };
}

export function useResources(filters: ResourcesFilters = {}) {
  return useInfiniteQuery({
    queryKey: resourcesQueryKey(filters),
    queryFn: ({ pageParam }) => fetchResourcesPage(pageParam, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  });
}

/**
 * Toggle bookmark optimiste sur toutes les queries de la verticale Cours.
 */
export function useToggleResourceBookmark() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { resourceId: string }>({
    mutationFn: async ({ resourceId }) => {
      const { data, error } = await supabase.rpc('toggle_resource_bookmark', {
        p_resource_id: resourceId,
      });
      if (error) {
        logger.warn('toggle_resource_bookmark failed', {
          message: error.message,
          resourceId,
        });
        throw error;
      }
      return Boolean(data);
    },
    onMutate: async ({ resourceId }) => {
      await queryClient.cancelQueries({ queryKey: ['cours', 'resources'] });
      queryClient.setQueriesData<ResourcesQueryData>(
        { queryKey: ['cours', 'resources'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              resources: page.resources.map((r) =>
                r.id === resourceId ? { ...r, bookmarked_by_me: !r.bookmarked_by_me } : r
              ),
            })),
          };
        }
      );
      // Flip aussi le cache de la fiche détail (feedback immédiat sur E9-05).
      queryClient.setQueriesData<BookmarkableDetail | undefined>(
        { queryKey: ['cours', 'detail'] },
        (old) =>
          old && old.id === resourceId ? { ...old, bookmarked_by_me: !old.bookmarked_by_me } : old
      );
    },
    onError: (_err, vars) => {
      queryClient.setQueriesData<ResourcesQueryData>(
        { queryKey: ['cours', 'resources'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              resources: page.resources.map((r) =>
                r.id === vars.resourceId ? { ...r, bookmarked_by_me: !r.bookmarked_by_me } : r
              ),
            })),
          };
        }
      );
      // Rollback du cache détail aussi.
      queryClient.setQueriesData<BookmarkableDetail | undefined>(
        { queryKey: ['cours', 'detail'] },
        (old) =>
          old && old.id === vars.resourceId
            ? { ...old, bookmarked_by_me: !old.bookmarked_by_me }
            : old
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['cours', 'bookmarks'] });
    },
  });
}
