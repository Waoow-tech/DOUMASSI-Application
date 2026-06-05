import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { AlertCircle, ArrowLeft, Search, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { UserRow } from '@/features/profile/components/UserRow';
import { type SearchUserResult, useSearchUsers } from '@/features/profile/hooks/useSearchUsers';
import { logger } from '@/lib/logger';

function SearchState({ icon, title }: { icon: 'search' | 'error'; title: string }) {
  const Icon = icon === 'search' ? Search : AlertCircle;

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
      <Icon size={32} color="#A0A0A0" />
      <Text color="$textSecondary" fontSize={15} textAlign="center">
        {title}
      </Text>
    </YStack>
  );
}

export default function NewMessageRoute() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { users, debouncedQuery, canSearch, isLoading, isError } = useSearchUsers(query);
  const getOrCreateDm = useGetOrCreateDm();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, []);

  const handleSelectUser = useCallback(
    (user: SearchUserResult) => {
      setSelectedUserId(user.id);
      getOrCreateDm.mutate(user.id, {
        onSuccess: (conversationId) => {
          router.replace(`/messages/${conversationId}`);
        },
        onError: (err) => {
          logger.warn('Open DM failed', { message: err.message, userId: user.id });
          setSelectedUserId(null);
        },
      });
    },
    [getOrCreateDm]
  );

  const renderUser = useCallback(
    ({ item }: { item: SearchUserResult }) => (
      <UserRow
        user={item}
        onPress={() => handleSelectUser(item)}
        rightSlot={selectedUserId === item.id ? <Spinner size="small" color="$color" /> : null}
      />
    ),
    [handleSelectUser, selectedUserId]
  );

  const keyExtractor = useCallback((item: SearchUserResult) => item.id, []);
  const showEmptyState = !canSearch;
  const showNoResults = canSearch && !isLoading && !isError && users.length === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <XStack
          height={56}
          paddingHorizontal="$3"
          alignItems="center"
          gap="$3"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <Button
            circular
            size="$3"
            chromeless
            onPress={handleBack}
            pressStyle={{ opacity: 0.7 }}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Button>
          <Text color="$color" fontSize={18} fontWeight="700">
            Nouvelle conversation
          </Text>
        </XStack>

        <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$3">
          <XStack
            alignItems="center"
            gap="$2"
            height={48}
            backgroundColor="$surface"
            borderRadius="$md"
            paddingHorizontal="$3"
          >
            <Search size={20} color="#A0A0A0" />
            <Input
              id="new-message-search-users-input"
              flex={1}
              height={48}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder="Rechercher un utilisateur..."
              placeholderTextColor="$placeholderColor"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={query}
              onChangeText={setQuery}
              paddingHorizontal={0}
              fontSize={16}
            />
            {query.length > 0 ? (
              <Button
                id="new-message-search-users-clear-button"
                circular
                size="$2.5"
                chromeless
                onPress={() => setQuery('')}
                pressStyle={{ opacity: 0.65 }}
                accessibilityLabel="Effacer la recherche"
              >
                <X size={18} color="#A0A0A0" />
              </Button>
            ) : null}
          </XStack>
        </YStack>

        {showEmptyState ? (
          <SearchState icon="search" title="Recherchez par username ou nom" />
        ) : isLoading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" color="$color" />
          </YStack>
        ) : isError ? (
          <SearchState icon="error" title="Recherche impossible. Réessayez." />
        ) : showNoResults ? (
          <SearchState icon="search" title={`Aucun utilisateur trouvé pour '@${debouncedQuery}'`} />
        ) : (
          <FlashList<SearchUserResult>
            data={users}
            renderItem={renderUser}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
  },
});
