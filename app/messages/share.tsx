import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ArrowLeft, CheckCircle2, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { UserRow } from '@/features/profile/components/UserRow';
import { type SearchUserResult, useSearchUsers } from '@/features/profile/hooks/useSearchUsers';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

type ShareKind = 'post' | 'profile';

type ToastState = {
  message: string;
};

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

function normalizeParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : null;
}

export default function InternalShareRoute() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    type?: ShareKind;
    postId?: string;
    username?: string;
  }>();
  const shareKind = params.type === 'post' || params.type === 'profile' ? params.type : null;
  const postId = normalizeParam(params.postId);
  const username = normalizeParam(params.username);
  const message =
    shareKind === 'post' && postId
      ? `https://doumassi.app/post/${postId}`
      : shareKind === 'profile' && username
        ? `https://doumassi.app/profile/${username}`
        : null;

  const [query, setQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { users, debouncedQuery, canSearch, isLoading, isError } = useSearchUsers(query);
  const getOrCreateDm = useGetOrCreateDm();
  const sendMessage = useSendMessage();

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });
  }, []);

  const handleBack = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, []);

  const handleSelectUser = useCallback(
    async (user: SearchUserResult) => {
      if (!message || !shareKind) return;
      if (user.id === currentUserId) {
        setToast({ message: t.messaging.share.toastSelectOther });
        return;
      }

      setSelectedUserId(user.id);
      try {
        const conversationId = await getOrCreateDm.mutateAsync(user.id);
        await sendMessage.mutateAsync({ conversationId, content: message });

        if (shareKind === 'post' && postId) {
          await supabase.rpc('increment_share_count', { p_post_id: postId });
          Sentry.captureMessage('post_shared_internal', {
            level: 'info',
            extra: { postId, recipientUserId: user.id, conversationId },
          });
        } else if (shareKind === 'profile' && username) {
          Sentry.captureMessage('profile_shared_internal', {
            level: 'info',
            extra: { username, recipientUserId: user.id, conversationId },
          });
        }

        setToast({ message: t.messaging.share.toastSent });
        redirectTimeoutRef.current = setTimeout(() => {
          router.replace(`/messages/${conversationId}`);
        }, 750);
      } catch (err) {
        logger.warn('Internal share failed', {
          message: (err as Error).message,
          recipientUserId: user.id,
          shareKind,
        });
        setSelectedUserId(null);
        setToast({ message: t.messaging.share.toastSendFailed });
      }
    },
    [currentUserId, getOrCreateDm, message, postId, sendMessage, shareKind, username, t]
  );

  const renderUser = useCallback(
    ({ item }: { item: SearchUserResult }) => (
      <UserRow
        user={item}
        onPress={() => void handleSelectUser(item)}
        rightSlot={selectedUserId === item.id ? <Spinner size="small" color="$color" /> : null}
      />
    ),
    [handleSelectUser, selectedUserId]
  );

  const keyExtractor = useCallback((item: SearchUserResult) => item.id, []);
  const visibleUsers = currentUserId ? users.filter((user) => user.id !== currentUserId) : users;
  const showEmptyState = !canSearch;
  const showNoResults = canSearch && !isLoading && !isError && visibleUsers.length === 0;

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
            accessibilityLabel={t.messaging.common.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Button>
          <Text color="$color" fontSize={18} fontWeight="700">
            {t.messaging.share.title}
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
              id="internal-share-search-users-input"
              flex={1}
              height={48}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder={t.messaging.share.searchPlaceholder}
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
                id="internal-share-search-users-clear-button"
                circular
                size="$2.5"
                chromeless
                onPress={() => setQuery('')}
                pressStyle={{ opacity: 0.65 }}
                accessibilityLabel={t.messaging.common.clearSearch}
              >
                <X size={18} color="#A0A0A0" />
              </Button>
            ) : null}
          </XStack>
        </YStack>

        {!message ? (
          <SearchState icon="error" title={t.messaging.share.linkUnavailable} />
        ) : showEmptyState ? (
          <SearchState icon="search" title={t.messaging.common.searchByUsernameOrName} />
        ) : isLoading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" color="$color" />
          </YStack>
        ) : isError ? (
          <SearchState icon="error" title={t.messaging.common.searchError} />
        ) : showNoResults ? (
          <SearchState icon="search" title={t.messaging.common.noResultsFor(debouncedQuery)} />
        ) : (
          <FlashList<SearchUserResult>
            data={visibleUsers}
            renderItem={renderUser}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {toast ? (
          <XStack
            position="absolute"
            bottom={24 + insets.bottom}
            alignSelf="center"
            backgroundColor="$surfaceElevated"
            borderWidth={1}
            borderColor="$accentNeon"
            borderRadius="$4"
            paddingHorizontal="$4"
            paddingVertical="$2"
            alignItems="center"
            gap="$2"
          >
            <CheckCircle2 size={16} color="#FFFFFF" />
            <Text color="$color" fontSize={13} fontWeight="700">
              {toast.message}
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
  },
});
