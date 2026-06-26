// Route helper Sprint 6, ticket #213 — Mentions.
//
// Le composant MentionsText navigue vers `/profile/u/{username}` quand on tape
// une mention. Cette route résout le username en user.id puis redirige vers
// le screen profile standard `/profile/[id]`.
//
// On passe par une route dédiée plutôt qu'un resolve inline dans MentionsText
// pour :
//   1. Centraliser la requête (1 endroit pour le caching futur)
//   2. Gérer proprement le 404 (username supprimé / renommé / typo)
//   3. Permettre le deep linking via le scheme `doumassi://profile/u/X`
//      (utile pour ouvrir un profil depuis une notification push ou un share
//      externe avec juste l'username).

import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Button, Spinner, Text, YStack } from 'tamagui';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

type ResolveState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export default function ResolveUsernameRoute() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const rawUsername = typeof username === 'string' ? username : null;
  const normalized = rawUsername?.toLowerCase().replace(/^@+/, '').trim() ?? null;

  const [state, setState] = useState<ResolveState>({ status: 'loading' });

  useEffect(() => {
    if (!normalized) {
      setState({ status: 'not_found' });
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        logger.warn('resolve username failed', { username: normalized, message: error.message });
        setState({ status: 'error', message: error.message });
        return;
      }

      if (!data) {
        setState({ status: 'not_found' });
        return;
      }

      // Replace pour éviter d'empiler cette route intermédiaire dans le back stack.
      router.replace(`/profile/${data.id}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (state.status === 'loading') {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color="$accentNeon" />
      </YStack>
    );
  }

  if (state.status === 'not_found') {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$3"
        padding="$5"
        backgroundColor="$background"
      >
        <UserX size={48} color="#A0A0A0" />
        <Text fontSize={18} fontWeight="600" color="$color" textAlign="center">
          Utilisateur introuvable
        </Text>
        <Text fontSize={14} color="$textSecondary" textAlign="center">
          {rawUsername ? `@${rawUsername} n'existe pas ou a été supprimé.` : 'Username invalide.'}
        </Text>
        <Button
          marginTop="$2"
          onPress={() => router.back()}
          icon={ChevronLeft}
          backgroundColor="$accentNeon"
          color="#000000"
        >
          Retour
        </Button>
      </YStack>
    );
  }

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      padding="$5"
      backgroundColor="$background"
    >
      <Text fontSize={16} fontWeight="600" color="$color" textAlign="center">
        Erreur de chargement
      </Text>
      <Text fontSize={13} color="$textSecondary" textAlign="center">
        {state.message}
      </Text>
      <Button marginTop="$2" onPress={() => router.back()} icon={ChevronLeft}>
        Retour
      </Button>
    </YStack>
  );
}
