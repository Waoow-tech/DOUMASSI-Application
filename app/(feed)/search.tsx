import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { AlertCircle, Search, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import { UserRow } from '@/features/profile/components/UserRow';
import { type SearchUserResult, useSearchUsers } from '@/features/profile/hooks/useSearchUsers';

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

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { users, debouncedQuery, canSearch, isLoading, isError } = useSearchUsers(query);

  const handleUserPress = useCallback((userId: string) => {
    router.push(`/profile/${userId}`);
  }, []);

  const renderUser = useCallback(
    ({ item }: { item: SearchUserResult }) => <UserRow user={item} onPress={handleUserPress} />,
    [handleUserPress]
  );

  const keyExtractor = useCallback((item: SearchUserResult) => item.id, []);

  const showEmptyState = !canSearch;
  const showNoResults = canSearch && !isLoading && !isError && users.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <YStack flex={1} backgroundColor="$background">
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
              id="search-users-input"
              flex={1}
              height={48}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder="Search users..."
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
                id="search-users-clear-button"
                circular
                size="$2.5"
                chromeless
                onPress={() => setQuery('')}
                pressStyle={{ opacity: 0.65 }}
                accessibilityLabel="Clear search"
              >
                <X size={18} color="#A0A0A0" />
              </Button>
            ) : null}
          </XStack>
        </YStack>

        {showEmptyState ? (
          <SearchState icon="search" title="Search by username or name" />
        ) : isLoading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" color="$color" />
          </YStack>
        ) : isError ? (
          <SearchState icon="error" title="Search failed. Please try again." />
        ) : showNoResults ? (
          <SearchState icon="search" title={`No users found for '@${debouncedQuery}'`} />
        ) : (
          <FlashList<SearchUserResult>
            data={users}
            renderItem={renderUser}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </YStack>
    </SafeAreaView>
  );
}
