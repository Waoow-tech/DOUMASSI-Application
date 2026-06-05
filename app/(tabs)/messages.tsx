import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { MessageCircle, Plus } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack } from 'tamagui';

import {
  ConversationRow,
  ConversationRowSkeleton,
} from '@/features/messaging/components/ConversationRow';
import {
  type ConversationListRow,
  useMyConversations,
} from '@/features/messaging/hooks/useMyConversations';

function MessagesEmptyState() {
  return (
    <YStack
      flex={1}
      minHeight={360}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      padding="$6"
    >
      <MessageCircle size={36} color="#A0A0A0" strokeWidth={1.7} />
      <Text color="$textSecondary" fontSize={15} textAlign="center">
        Aucune conversation, démarrez-en une avec le +
      </Text>
    </YStack>
  );
}

function MessagesSkeleton() {
  return (
    <YStack paddingTop="$2">
      {Array.from({ length: 5 }).map((_, index) => (
        <ConversationRowSkeleton key={index} />
      ))}
    </YStack>
  );
}

export default function MessagesRoute() {
  const insets = useSafeAreaInsets();
  const conversationsQuery = useMyConversations();

  const conversations = useMemo(() => {
    return (conversationsQuery.data ?? []).filter((conversation) => !conversation.is_group);
  }, [conversationsQuery.data]);

  const handleOpenConversation = useCallback((conversationId: string) => {
    router.push(`/messages/${conversationId}`);
  }, []);

  const renderConversation = useCallback(
    ({ item }: { item: ConversationListRow }) => (
      <ConversationRow
        conversation={item}
        onPress={() => handleOpenConversation(item.conversation_id)}
      />
    ),
    [handleOpenConversation]
  );

  const keyExtractor = useCallback((item: ConversationListRow) => item.conversation_id, []);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <XStack
        height={58}
        paddingHorizontal="$4"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
      >
        <Text color="$color" fontSize={24} fontWeight="700">
          Messages
        </Text>
        <Button
          circular
          size="$3"
          chromeless
          onPress={() => router.push('/messages/new')}
          pressStyle={{ opacity: 0.7 }}
          accessibilityLabel="Nouvelle conversation"
        >
          <Plus size={24} color="#FFFFFF" />
        </Button>
      </XStack>

      {conversationsQuery.isLoading ? (
        <MessagesSkeleton />
      ) : (
        <FlashList<ConversationListRow>
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              tintColor="#FFFFFF"
              refreshing={conversationsQuery.isRefetching}
              onRefresh={() => void conversationsQuery.refetch()}
            />
          }
          ListEmptyComponent={<MessagesEmptyState />}
        />
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 8,
    paddingBottom: 96,
  },
});
