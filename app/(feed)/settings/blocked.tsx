import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, View, XStack, YStack } from 'tamagui';

import { UserRow, type UserRowData } from '@/features/profile/components/UserRow';
import { useBlock } from '@/features/profile/hooks/useBlock';
import { blockedUsersQueryKey, useBlockedUsers } from '@/features/profile/hooks/useBlockedUsers';
import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';

function UnblockButton({ user, onUnblocked }: { user: UserRowData; onUnblocked: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { unblock, isPending } = useBlock(user.id);

  const handleUnblock = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: blockedUsersQueryKey });
    const previousUsers = queryClient.getQueryData<UserRowData[]>(blockedUsersQueryKey);

    queryClient.setQueryData<UserRowData[]>(blockedUsersQueryKey, (old) =>
      old ? old.filter((blockedUser) => blockedUser.id !== user.id) : old
    );

    try {
      await unblock();
      onUnblocked();
    } catch (err) {
      logger.warn('Unblock from blocked users screen failed', {
        message: (err as Error).message,
      });

      if (previousUsers) {
        queryClient.setQueryData(blockedUsersQueryKey, previousUsers);
      }

      const tt = getT();
      Alert.alert(
        tt.profileScreens.blockedUsers.unblockErrorTitle,
        tt.profileScreens.blockedUsers.unblockErrorMessage
      );
    } finally {
      void queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey });
    }
  }, [onUnblocked, queryClient, unblock, user.id]);

  return (
    <Button
      minHeight={44}
      paddingHorizontal="$4"
      backgroundColor="transparent"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$md"
      onPress={() => void handleUnblock()}
      disabled={isPending}
      pressStyle={{ opacity: 0.72 }}
    >
      {isPending ? (
        <Spinner size="small" color="$danger" />
      ) : (
        <Button.Text color="$danger" fontSize={13} fontWeight="700">
          {t.profileScreens.blockedUsers.unblock}
        </Button.Text>
      )}
    </Button>
  );
}

export default function BlockedUsersScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const blockedUsersQuery = useBlockedUsers();
  const [toastVisible, setToastVisible] = useState(false);

  const showUnblockedToast = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1600);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: UserRowData }) => (
      <UserRow
        user={item}
        rightSlot={<UnblockButton user={item} onUnblocked={showUnblockedToast} />}
      />
    ),
    [showUnblockedToast]
  );

  const EmptyState = useCallback(() => {
    if (blockedUsersQuery.isLoading) {
      return (
        <YStack paddingVertical={100} alignItems="center">
          <Spinner size="large" color="#FFFFFF" />
        </YStack>
      );
    }

    return (
      <YStack paddingVertical={100} alignItems="center" gap="$3" paddingHorizontal="$6">
        <ShieldCheck size={48} color="#A0A0A0" />
        <Text color="$textSecondary" fontSize={16} fontWeight="600" textAlign="center">
          {t.profileScreens.blockedUsers.emptyTitle}
        </Text>
        <Text color="$placeholderColor" fontSize={14} textAlign="center">
          {t.profileScreens.blockedUsers.emptySubtitle}
        </Text>
      </YStack>
    );
  }, [blockedUsersQuery.isLoading, t]);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <XStack
        height={56}
        paddingHorizontal="$4"
        alignItems="center"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
      >
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text
          flex={1}
          marginLeft="$3"
          color="$color"
          fontSize={20}
          fontWeight="700"
          fontFamily="$heading"
        >
          {t.profileScreens.blockedUsers.title}
        </Text>
        <View width={24} />
      </XStack>

      <FlashList
        data={blockedUsersQuery.data ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={EmptyState}
        onRefresh={() => void blockedUsersQuery.refetch()}
        refreshing={blockedUsersQuery.isRefetching}
        contentContainerStyle={styles.listContent}
      />

      {toastVisible ? (
        <XStack
          position="absolute"
          bottom={96}
          left={0}
          right={0}
          justifyContent="center"
          pointerEvents="none"
        >
          <XStack
            backgroundColor="$surface"
            paddingHorizontal="$4"
            paddingVertical="$3"
            borderRadius="$lg"
            alignItems="center"
            gap="$2"
          >
            <ShieldCheck size={16} color="#FFFFFF" />
            <Text color="$color" fontSize={14} fontWeight="600">
              {t.profileScreens.blockedUsers.unblockedToast}
            </Text>
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
});
