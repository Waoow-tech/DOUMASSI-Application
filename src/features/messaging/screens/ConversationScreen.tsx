// ConversationScreen — E6-03 + E6-05.
//
// Écran de conversation 1-to-1. Header avec avatar + username de l'autre.
// FlashList inversée des messages, paginée vers le haut (cursor created_at).
// Input texte en bas (KeyboardAvoidingView).
// Marquage lu auto au mount + au focus.
// Long-press sur mes bulles → sheet d'actions (Modifier / Supprimer).
//
// Hors scope bêta (cohérent avec spec recadrée le 02/06/2026) :
//   - Boutons d'appel audio/vidéo Daily.co (Sprint 6+ tickets #85-88)
//   - Voice/video : voice livré #211
//   - Réponses : livré #209 (state replyingTo + scroll vers parent)

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Phone, Video } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { useStartCall, type CallType } from '@/features/calls/hooks/useStartCall';
import { MessageActionSheet } from '@/features/messaging/components/MessageActionSheet';
import {
  MessageBubble,
  type ReplyParentPreview,
} from '@/features/messaging/components/MessageBubble';
import { MessageInput, type ReplyingPreview } from '@/features/messaging/components/MessageInput';
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
import { useProfilesByIds } from '@/features/profile/hooks/useProfilesByIds';
import { logger } from '@/lib/logger';
import { uploadMessageAudio, uploadMessageImage } from '@/lib/storage';
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
  // Ticket #209 — message en cours de réponse (sélectionné via ActionSheet).
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const listRef = useRef<FlashListRef<MessageRow>>(null);

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

  // Ticket #209 — index id→message pour résoudre les parents en O(1) au
  // moment du rendu des bulles.
  const messagesById = useMemo(() => {
    const map = new Map<string, MessageRow>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Follow-up #212/#209 — résolution des senders en batch (1 query).
  const senderIds = useMemo(
    () => Array.from(new Set(messages.map((m) => m.sender_id).filter((id) => id !== meId))),
    [meId, messages]
  );
  const { profilesById } = useProfilesByIds(senderIds);
  const isGroup = headerQuery.data?.is_group ?? false;

  /** Construit le preview à afficher dans l'encart "Réponse à" ou la bulle. */
  const buildReplyPreview = useCallback(
    (parent: MessageRow): { authorLabel: string; preview: string; isDeleted: boolean } => {
      const isParentMine = parent.sender_id === meId;
      const isDeleted = parent.deleted_at !== null;
      let preview: string;
      if (parent.attachment_type === 'image') {
        preview = '📷 Photo';
      } else if (parent.attachment_type === 'voice') {
        preview = '🎙️ Message vocal';
      } else if (parent.attachment_type === 'video') {
        preview = '🎬 Vidéo';
      } else {
        preview = (parent.content ?? '').slice(0, 50);
      }
      // Résolution du username depuis le batch profilesById (follow-up #212).
      // Fallback sur display_name du header pour les DMs si le profile n'est
      // pas encore chargé, puis "@un membre" en dernier recours.
      const senderProfile = profilesById.get(parent.sender_id);
      let otherLabel: string;
      if (senderProfile?.username) {
        otherLabel = `@${senderProfile.username}`;
      } else if (headerQuery.data?.display_name && !headerQuery.data.is_group) {
        otherLabel = `@${headerQuery.data.display_name}`;
      } else {
        otherLabel = '@un membre';
      }
      return {
        authorLabel: isParentMine ? 'votre message' : otherLabel,
        preview,
        isDeleted,
      };
    },
    [headerQuery.data?.display_name, headerQuery.data?.is_group, meId, profilesById]
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!convId) return;
      const replyToId = replyingTo?.id ?? null;
      sendMessage.mutate(
        { conversationId: convId, content, replyToId },
        {
          onError: (err) => {
            logger.warn('Send message failed', { message: err.message });
          },
        }
      );
      // On reset l'état de réponse immédiatement (UX) — si l'envoi échoue,
      // la bulle apparaît en "failed" mais le composer est libre pour autre chose.
      setReplyingTo(null);
    },
    [convId, replyingTo, sendMessage]
  );

  // Ticket #210 — pièce jointe image.
  const [isAttaching, setIsAttaching] = useState(false);

  const handleSendImage = useCallback(
    async (imageUri: string) => {
      if (!convId) return;
      setIsAttaching(true);
      const replyToId = replyingTo?.id ?? null;
      try {
        const { publicUrl } = await uploadMessageImage(imageUri);
        sendMessage.mutate(
          {
            conversationId: convId,
            content: '',
            attachmentType: 'image',
            attachmentUrl: publicUrl,
            replyToId,
          },
          {
            onError: (err) => {
              logger.warn('Send image message failed', { message: err.message });
              Alert.alert("Échec de l'envoi", err.message);
            },
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload échoué';
        logger.warn('Upload message image failed', { message: msg });
        Alert.alert("Échec de l'upload", msg);
      } finally {
        setIsAttaching(false);
        setReplyingTo(null);
      }
    },
    [convId, replyingTo, sendMessage]
  );

  // Ticket #211 — envoi vocal.
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  const handleSendVoice = useCallback(
    async (audioUri: string, durationSeconds: number) => {
      if (!convId) return;
      setIsSendingVoice(true);
      const replyToId = replyingTo?.id ?? null;
      try {
        const { publicUrl } = await uploadMessageAudio(audioUri);
        sendMessage.mutate(
          {
            conversationId: convId,
            content: String(durationSeconds),
            attachmentType: 'voice',
            attachmentUrl: publicUrl,
            replyToId,
          },
          {
            onError: (err) => {
              logger.warn('Send voice message failed', { message: err.message });
              Alert.alert("Échec de l'envoi", err.message);
            },
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload audio échoué';
        logger.warn('Upload message audio failed', { message: msg });
        Alert.alert("Échec de l'upload", msg);
      } finally {
        setIsSendingVoice(false);
        setReplyingTo(null);
      }
    },
    [convId, replyingTo, sendMessage]
  );

  const handleAttach = useCallback(() => {
    if (isAttaching) return;
    Alert.alert('Ajouter une image', undefined, [
      {
        text: 'Galerie',
        onPress: async () => {
          let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
          if (!perm.granted) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission refusée', "Active l'accès aux photos dans Réglages.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 1,
          });
          if (result.canceled) return;
          const asset = result.assets[0];
          if (asset) await handleSendImage(asset.uri);
        },
      },
      {
        text: 'Caméra',
        onPress: async () => {
          let perm = await ImagePicker.getCameraPermissionsAsync();
          if (!perm.granted) perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission refusée', "Active l'accès à la caméra dans Réglages.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
          });
          if (result.canceled) return;
          const asset = result.assets[0];
          if (asset) await handleSendImage(asset.uri);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [handleSendImage, isAttaching]);

  const handleLongPressBubble = useCallback((message: MessageRow) => {
    setActionMessage(message);
    setActionSheetOpen(true);
  }, []);

  // Ticket #209 — réponses.
  const handleReplyFromSheet = useCallback((message: MessageRow) => {
    setReplyingTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  /**
   * Scroll vers le message parent dans la liste. La liste est INVERTED
   * (la plus récente en haut), donc l'index 0 = bas visuel du composer.
   * Si le parent n'est pas dans les pages déjà chargées, on signale via Alert
   * (charger plus en arrière nécessiterait un fetchNextPage en boucle — pas
   * dans le scope MVP).
   */
  const handleScrollToParent = useCallback(
    (parentId: string) => {
      const index = messages.findIndex((m) => m.id === parentId);
      if (index === -1) {
        Alert.alert(
          'Message non chargé',
          'Le message parent est trop ancien. Faites défiler vers le haut puis réessayez.'
        );
        return;
      }
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    },
    [messages]
  );

  const replyingPreview = useMemo<ReplyingPreview | null>(() => {
    if (!replyingTo) return null;
    const { authorLabel, preview } = buildReplyPreview(replyingTo);
    return { authorLabel, preview: preview || '...' };
  }, [buildReplyPreview, replyingTo]);

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

  // Ticket #231 — démarrer un appel (DM only MVP).
  const startCall = useStartCall();

  const handleStartCall = useCallback(
    (callType: CallType) => {
      if (!convId || startCall.isPending) return;
      startCall.mutate(
        { conversationId: convId, callType },
        {
          onSuccess: ({ callId, roomUrl, token }) => {
            router.push({
              pathname: '/call/[id]',
              params: {
                id: callId,
                roomUrl,
                token,
                callType,
                isInitiator: '1',
              },
            });
          },
          onError: (err) => {
            logger.warn('Start call failed', { message: err.message });
            Alert.alert("Impossible de lancer l'appel", err.message);
          },
        }
      );
    },
    [convId, startCall]
  );

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

  const renderMessage = useCallback(
    ({ item }: { item: MessageRow }) => {
      const isMine = item.sender_id === meId;
      const senderProfile = !isMine ? profilesById.get(item.sender_id) : undefined;
      let replyParent: ReplyParentPreview | null = null;
      if (item.reply_to_id) {
        const parent = messagesById.get(item.reply_to_id);
        if (parent) {
          const { authorLabel, preview, isDeleted } = buildReplyPreview(parent);
          replyParent = { id: parent.id, authorLabel, preview, isDeleted };
        } else {
          // Parent pas dans les pages chargées : on rend l'encart en mode "déchargé".
          replyParent = {
            id: item.reply_to_id,
            authorLabel: 'Message',
            preview: 'Faire défiler pour voir le message original…',
            isDeleted: false,
          };
        }
      }
      return (
        <MessageBubble
          message={item}
          isMine={isMine}
          isGroup={isGroup}
          senderProfile={
            senderProfile
              ? { username: senderProfile.username, avatar_url: senderProfile.avatar_url }
              : null
          }
          replyParent={replyParent}
          onReplyPress={handleScrollToParent}
          onLongPress={handleLongPressBubble}
        />
      );
    },
    [
      buildReplyPreview,
      handleLongPressBubble,
      handleScrollToParent,
      isGroup,
      meId,
      messagesById,
      profilesById,
    ]
  );

  // Header
  const header = headerQuery.data;
  const initial =
    header?.display_name && header.display_name.length > 0
      ? header.display_name.charAt(0).toUpperCase()
      : '?';

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

        {/* Boutons d'appel #231 — DM only (les groupes arrivent en V2) */}
        {!isGroup ? (
          <XStack gap={14} alignItems="center">
            <Pressable
              onPress={() => handleStartCall('audio')}
              disabled={startCall.isPending}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Appel audio"
              accessibilityHint={`Tap pour appeler ${header?.display_name ?? ''} en audio`}
              accessibilityState={{ disabled: startCall.isPending }}
            >
              {startCall.isPending && startCall.variables?.callType === 'audio' ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Phone size={22} color="#FFFFFF" />
              )}
            </Pressable>
            <Pressable
              onPress={() => handleStartCall('video')}
              disabled={startCall.isPending}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Appel vidéo"
              accessibilityHint={`Tap pour appeler ${header?.display_name ?? ''} en vidéo`}
              accessibilityState={{ disabled: startCall.isPending }}
            >
              {startCall.isPending && startCall.variables?.callType === 'video' ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Video size={22} color="#FFFFFF" />
              )}
            </Pressable>
          </XStack>
        ) : null}
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
              ref={listRef}
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
          onAttach={handleAttach}
          isAttaching={isAttaching}
          onSendVoice={handleSendVoice}
          isSendingVoice={isSendingVoice}
          replyingTo={replyingPreview}
          onCancelReply={handleCancelReply}
          disabled={sendMessage.isPending || isAttaching || isSendingVoice}
        />
        <View style={{ height: insets.bottom }} backgroundColor="$surface" />
      </KeyboardAvoidingView>

      {/* Sheet d'actions sur long-press */}
      <MessageActionSheet
        message={actionMessage}
        isMine={actionMessage?.sender_id === meId}
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReply={handleReplyFromSheet}
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
