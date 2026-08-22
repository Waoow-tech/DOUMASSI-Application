import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface SearchUserResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/^@+/, '');
}

export function useSearchUsers(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(normalizeSearchQuery(query));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const canSearch = debouncedQuery.length >= 2;

  const usersQuery = useQuery({
    queryKey: ['search', 'users', debouncedQuery],
    queryFn: async (): Promise<SearchUserResult[]> => {
      const { data, error } = await supabase.rpc('search_users', {
        p_query: debouncedQuery,
        p_limit: 30,
      });

      if (error) {
        logger.warn('Search users failed', { message: error.message, query: debouncedQuery });
        throw error;
      }

      return ((data ?? []) as Record<string, unknown>[]).map((user) => ({
        id: String(user.id ?? ''),
        username: String(user.username ?? ''),
        full_name: (user.full_name as string | null) ?? null,
        avatar_url: (user.avatar_url as string | null) ?? null,
        is_verified: typeof user.is_verified === 'boolean' ? user.is_verified : false,
      }));
    },
    enabled: canSearch,
    staleTime: 30_000,
  });

  return useMemo(
    () => ({
      users: usersQuery.data ?? [],
      debouncedQuery,
      canSearch,
      isLoading: usersQuery.isFetching,
      isError: usersQuery.isError,
      refetch: usersQuery.refetch,
    }),
    [
      canSearch,
      debouncedQuery,
      usersQuery.data,
      usersQuery.isError,
      usersQuery.isFetching,
      usersQuery.refetch,
    ]
  );
}
