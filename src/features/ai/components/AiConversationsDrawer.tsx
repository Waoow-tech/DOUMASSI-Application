// Drawer latéral des conversations IA — E5-04.
//
// Panneau qui glisse depuis la gauche : liste des conversations (plus récente
// d'abord), bouton « nouvelle conversation », suppression par ligne.
//
// Implémentation volontairement standard (Modal RN + Animated.translateX) : pas
// de lib de gestes, pas d'animation exotique — ce genre d'écran ne se teste pas
// facilement sur device, donc on mise sur du éprouvé.

import { FlashList } from '@shopify/flash-list';
import { MessageSquarePlus, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Dimensions, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import {
  useAiConversations,
  useDeleteAiConversation,
  type AiConversationSummary,
} from '../hooks/useAiConversation';
import { conversationLabel } from '../lib/conversationLabel';

const ACCENT = '#FFFFFF';
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.84, 360);

export interface AiConversationsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Conversation actuellement affichée (surlignée). */
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function AiConversationsDrawer({
  open,
  onClose,
  activeId,
  onSelect,
  onNewChat,
}: AiConversationsDrawerProps) {
  const t = useTranslations();
  const insets = useSafeAreaInsets();

  const conversationsQuery = useAiConversations();
  const deleteConversation = useDeleteAiConversation();

  // Animation d'ouverture/fermeture. On garde le Modal monté pendant l'anim de
  // sortie via `visible` piloté par un état interne serait plus lourd ; ici on
  // s'appuie sur le `open` du parent et on anime à chaque changement.
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, translateX, backdrop]);

  const handleDelete = (conversation: AiConversationSummary) => {
    Alert.alert(t.ai.drawer.deleteTitle, t.ai.drawer.deleteMessage, [
      { text: t.ai.drawer.cancel, style: 'cancel' },
      {
        text: t.ai.drawer.delete,
        style: 'destructive',
        onPress: () => deleteConversation.mutate(conversation.id),
      },
    ]);
  };

  const conversations = conversationsQuery.data ?? [];

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t.ai.drawer.closeA11y}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { width: DRAWER_WIDTH, paddingTop: insets.top, transform: [{ translateX }] },
        ]}
      >
        {/* En-tête */}
        <XStack alignItems="center" paddingHorizontal={16} paddingVertical={12} gap={10}>
          <Text flex={1} fontSize={17} fontWeight="800" color="$color">
            {t.ai.drawer.title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.ai.drawer.closeA11y}
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </XStack>

        {/* Nouvelle conversation */}
        <Pressable
          onPress={() => {
            onNewChat();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={t.ai.drawer.newChat}
        >
          <XStack
            alignItems="center"
            gap={10}
            marginHorizontal={12}
            marginBottom={8}
            paddingHorizontal={14}
            paddingVertical={12}
            borderRadius={12}
            backgroundColor="$surface"
          >
            <MessageSquarePlus size={18} color={ACCENT} />
            <Text fontSize={15} fontWeight="700" color="$color">
              {t.ai.drawer.newChat}
            </Text>
          </XStack>
        </Pressable>

        {/* Liste */}
        {conversationsQuery.isLoading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner color={ACCENT} />
          </YStack>
        ) : conversations.length === 0 ? (
          <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={24}>
            <Text color="$textSecondary" fontSize={14} textAlign="center">
              {t.ai.drawer.empty}
            </Text>
          </YStack>
        ) : (
          <FlashList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                active={item.id === activeId}
                label={conversationLabel(item, t.ai.drawer.untitled)}
                onSelect={() => {
                  onSelect(item.id);
                  onClose();
                }}
                onDelete={() => handleDelete(item)}
              />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

function ConversationRow({
  conversation,
  active,
  label,
  onSelect,
  onDelete,
}: {
  conversation: AiConversationSummary;
  active: boolean;
  label: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();

  return (
    <XStack
      alignItems="center"
      gap={8}
      marginHorizontal={12}
      marginVertical={3}
      paddingHorizontal={14}
      paddingVertical={12}
      borderRadius={12}
      backgroundColor={active ? '$surfaceElevated' : 'transparent'}
      onPress={onSelect}
      pressStyle={{ opacity: 0.7 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <YStack flex={1} gap={2}>
        <Text fontSize={14} fontWeight={active ? '700' : '500'} color="$color" numberOfLines={1}>
          {label}
        </Text>
        <Text fontSize={12} color="$textSecondary">
          {t.ai.drawer.messageCount(conversation.message_count)}
        </Text>
      </YStack>
      <Pressable
        onPress={onDelete}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t.ai.drawer.deleteA11y}
      >
        <Trash2 size={16} color="#6B6B6B" />
      </Pressable>
    </XStack>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0A0A0A',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#2A2A2A',
  },
});
