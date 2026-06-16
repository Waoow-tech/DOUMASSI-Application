// ConversationScreen — E6-03 + E6-05 + E6-06.
//
// Écran de conversation 1-to-1. Header avec avatar + username de l'autre.
// FlashList inversée des messages, paginée vers le haut (cursor created_at).
// Input texte en bas (KeyboardAvoidingView).
// Marquage lu auto au mount + au focus.
// Long-press sur mes bulles → sheet d'actions (Modifier / Supprimer).
// Long-press sur les bulles des autres → sheet d'actions (Répondre).
//
// Hors scope bêta (cohérent avec spec recadrée le 02/06/2026) :
//   - Boutons d'appel audio/vidéo Daily.co (Sprint 6+ tickets #85-88)
//   - Pièces jointes image/voice/video

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { MessageActionSheet } from '@/features/messaging/components/MessageActionSheet';
import { MessageBubble } from '@/features/messaging/components/MessageBubble';
import { MessageInput } from '@/features/messaging/components/MessageInput';
import { useConversationHeader } from '@/features/messaging/hooks/useConversationHeader';
import {
  type MessageRow,
  useConversationMessages,
} from '@/features/messaging/hooks/useConversationMessages';
import {
  useDeleteMessage,
  useEditMessage,
  useMarkConversationRead,
} from '@/features/messaging/hooks/useMessageActions';
import { useRealtimeConversation } from '@/features/messaging/hooks/useRealtimeConversation';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const convId = typeof conversationId === 'string' ? conversationId : null;

  const headerQuery = useConversationHeader(convId);
  const messagesQuery = useConversationMessages(convId);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const editMessage = useEditMessage(convId ?? '');
  const deleteMessage = useDeleteMessage(convId ?? '');
  const { isRealtimeDown } = useRealtimeConversation(convId);

  const [meId, setMeId] = useState<string | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<MessageRow | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MessageRow | null>(null);
  const flashListRef = useRef<FlashListRef<MessageRow>>(null);

  // Récupère mon user_id au mount pour identifier les bulles "à moi"
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setMeId(data.session?.user.id ?? null);
    })();
  }, []);

  // Marquage lu au mount et à chaque focus de l'écran
  useFocusEffect(
    useCallback(() => {
      if (convId) {
        markRead.mutate(convId);
      }
    }, [convId, markRead])
  );

  // Aplatissement des pages en une seule liste (la plus récente en tête)
  const messages = useMemo<MessageRow[]>(() => {
    return messagesQuery.data?.pages.flatMap((p) => p.messages) ?? [];
  }, [messagesQuery.data]);

  // Lookup O(1) du message parent pour chaque réponse (reply_to_id), évite un
  // .find() par bulle rendue dans la liste.
  const messagesById = useMemo(() => {
    const map = new Map<string, MessageRow>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const handleSend = useCallback(
    (content: string, replyToId?: string | null) => {
      if (!convId) return;
      sendMessage.mutate(
        { conversationId: convId, content, replyToId },
        {
          onError: (err) => {
            logger.warn('Send message failed', { message: err.message });
          },
        }
      );
      setReplyTarget(null);
    },
    [convId, sendMessage]
  );

  const handleLongPressBubble = useCallback((message: MessageRow) => {
    setActionMessage(message);
    setActionSheetOpen(true);
  }, []);

  const handleReply = useCallback((message: MessageRow) => {
    setReplyTarget(message);
    setActionSheetOpen(false);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const handleReplyPress = useCallback(
    (parentId: string) => {
      const parent = messagesById.get(parentId);
      if (!parent) return;
      flashListRef.current?.scrollToItem({ item: parent, animated: true });
    },
    [messagesById]
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      await editMessage.mutateAsync({ messageId, newContent });
    },
    [editMessage]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      await deleteMessage.mutateAsync(messageId);
    },
    [deleteMessage]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, []);

  const handleLoadMore = useCallback(() => {
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      void messagesQuery.fetchNextPage();
    }
  }, [messagesQuery]);

  const handlePullToRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await messagesQuery.refetch();
    setIsManualRefreshing(false);
  }, [messagesQuery]);

  // Header
  const header = headerQuery.data;
  const initial =
    header?.display_name && header.display_name.length > 0
      ? header.display_name.charAt(0).toUpperCase()
      : '?';

  // 1-to-1 uniquement pour la bêta : l'auteur d'un message est soit moi, soit
  // l'autre participant affiché dans le header.
  const authorLabel = useCallback(
    (senderId: string) => (senderId === meId ? 'Toi' : (header?.display_name ?? '')),
    [meId, header?.display_name]
  );

  const renderMessage = useCallback(
    ({ item }: { item: MessageRow }) => {
      const parentMessage = item.reply_to_id ? (messagesById.get(item.reply_to_id) ?? null) : null;
      return (
        <MessageBubble
          message={item}
          isMine={item.sender_id === meId}
          parentMessage={parentMessage}
          parentAuthorLabel={parentMessage ? authorLabel(parentMessage.sender_id) : undefined}
          onLongPress={handleLongPressBubble}
          onReplyPress={handleReplyPress}
        />
      );
    },
    [meId, messagesById, authorLabel, handleLongPressBubble, handleReplyPress]
  );

  const actionMessageIsMine = actionMessage ? actionMessage.sender_id === meId : true;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* Header */}
      <XStack
        height={56}
        paddingHorizontal="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
      >
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>

        {header?.display_avatar_url ? (
          <Image
            source={{ uri: header.display_avatar_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <YStack
            style={styles.avatar}
            backgroundColor="$surface"
            alignItems="center"
            justifyContent="center"
          >
            <Text color="$color" fontSize={14} fontWeight="700">
              {initial}
            </Text>
          </YStack>
        )}

        <XStack flex={1} alignItems="center" gap={4}>
          <Text color="$color" fontSize={16} fontWeight="700" numberOfLines={1}>
            {header?.display_name ?? '...'}
          </Text>
          {header?.display_is_verified ? (
            <CheckCircle2 size={14} color="#10D970" fill="#10D970" />
          ) : null}
        </XStack>
        {/* Pas de bouton appel pour la bêta (Daily.co Sprint 6+) */}
      </XStack>

      {/* Bannière dégradée : Realtime indisponible → tirez pour rafraîchir */}
      {isRealtimeDown && (
        <YStack
          backgroundColor="$surface"
          paddingHorizontal="$3"
          paddingVertical={6}
          alignItems="center"
        >
          <Text fontSize={12} color="$textSecondary" textAlign="center">
            Connexion temps réel indisponible — tirez pour rafraîchir
          </Text>
        </YStack>
      )}

      {/* Liste messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}
      >
        <View flex={1} backgroundColor="$background">
          {messagesQuery.isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : (
            <FlashList
              ref={flashListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              inverted
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isManualRefreshing}
                  onRefresh={() => void handlePullToRefresh()}
                  tintColor="#10D970"
                  colors={['#10D970']}
                />
              }
              ListFooterComponent={
                messagesQuery.isFetchingNextPage ? (
                  <YStack paddingVertical="$3" alignItems="center">
                    <ActivityIndicator color="#FFFFFF" />
                  </YStack>
                ) : null
              }
              ListEmptyComponent={
                <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical={80}>
                  <Text color="$textSecondary" fontSize={14}>
                    Aucun message. Démarre la conversation 👋
                  </Text>
                </YStack>
              }
            />
          )}
        </View>

        <MessageInput
          onSend={handleSend}
          disabled={sendMessage.isPending}
          replyTo={replyTarget}
          replyToAuthorLabel={replyTarget ? authorLabel(replyTarget.sender_id) : undefined}
          onCancelReply={handleCancelReply}
        />
        <View style={{ height: insets.bottom }} backgroundColor="$surface" />
      </KeyboardAvoidingView>

      {/* Sheet d'actions sur long-press */}
      <MessageActionSheet
        message={actionMessage}
        isMine={actionMessageIsMine}
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReply={() => actionMessage && handleReply(actionMessage)}
        editIsPending={editMessage.isPending}
        deleteIsPending={deleteMessage.isPending}
      />
    </YStack>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
});
