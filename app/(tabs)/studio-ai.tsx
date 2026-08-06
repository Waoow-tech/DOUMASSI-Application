// Écran Studio AI — chat avec Doumassi AI (E5-03).
//
// Remplace le placeholder « bientôt disponible ». Gère UNE conversation ;
// l'historique multi-conversations (drawer) est le ticket E5-04.
//
// Flux d'un tour : la saisie appelle useAiChat.send() → l'Edge Function persiste
// les messages et streame la réponse → les fragments s'accumulent dans une bulle
// « en cours », puis on relit la conversation depuis la base (source de vérité).

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { GraduationCap, Plus, Send, Sparkles, Square, SquarePen, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextArea, XStack, YStack } from 'tamagui';

import { AiConversationsDrawer } from '@/features/ai/components/AiConversationsDrawer';
import { AiPlusMenu } from '@/features/ai/components/AiPlusMenu';
import { ChatBubble, MessageBubble, TypingBubble } from '@/features/ai/components/MessageBubble';
import { useAiAttachments } from '@/features/ai/hooks/useAiAttachments';
import { aiErrorMessage, mergeMessages, useAiChat } from '@/features/ai/hooks/useAiChat';
import { useAiMessages } from '@/features/ai/hooks/useAiConversation';
import { useTranslations } from '@/i18n';

const ACCENT = '#FFFFFF';
const MAX_INPUT_LENGTH = 4000;

export default function StudioAIRoute() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();

  const chat = useAiChat(null);
  const messagesQuery = useAiMessages(chat.conversationId);
  const attach = useAiAttachments();
  const [draft, setDraft] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const listRef = useRef<FlashListRef<ChatBubble>>(null);

  const messages = useMemo(
    () => mergeMessages(messagesQuery.data ?? [], chat.pending),
    [messagesQuery.data, chat.pending]
  );

  const showTyping = chat.pending?.isWaitingFirstChunk ?? false;
  const isEmpty = messages.length === 0 && !showTyping;

  const scrollToEnd = useCallback(() => {
    // léger différé : laisse la liste intégrer le nouvel item avant de scroller
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    // On bloque l'envoi tant qu'un upload de photo est en cours (sinon la ref
    // serveur n'existe pas encore).
    if (!content || chat.isStreaming || attach.isUploading) return;
    const options = { attachments: attach.refs, attachmentUris: attach.uris };
    setDraft('');
    attach.clear();
    Keyboard.dismiss();
    void chat.send(content, chat.conversationId, options).then(scrollToEnd);
    scrollToEnd();
  }, [draft, chat, attach, scrollToEnd]);

  const handleNewChat = useCallback(() => {
    if (chat.isStreaming) return;
    chat.setConversationId(null);
    chat.clearError();
    setDraft('');
    attach.clear();
  }, [chat, attach]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (chat.isStreaming) return;
      chat.setConversationId(id);
      chat.clearError();
      setDraft('');
    },
    [chat]
  );

  const handleSuggestion = useCallback((text: string) => {
    setDraft(text);
  }, []);

  const canSend = draft.trim().length > 0 && !chat.isStreaming && !attach.isUploading;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      {/* En-tête */}
      <XStack
        height={52}
        alignItems="center"
        paddingHorizontal={16}
        gap={10}
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderColor"
      >
        <Sparkles size={20} color={ACCENT} />
        <Text flex={1} fontSize={18} fontWeight="800" color="$color">
          {t.ai.header.title}
        </Text>
        {/* Historique et Learning sont désormais dans le menu ⊕ de la barre de
            saisie (maquette Canva). L'en-tête ne garde que « nouvelle
            conversation », l'action la plus fréquente. */}
        {chat.conversationId ? (
          <Pressable
            onPress={handleNewChat}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.ai.header.newChatA11y}
            disabled={chat.isStreaming}
            style={{ opacity: chat.isStreaming ? 0.4 : 1 }}
          >
            <SquarePen size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </XStack>

      {/* Bandeau « Mode Learning activé » (E5-08) */}
      {chat.mode === 'learning' ? (
        <XStack
          alignItems="center"
          gap={10}
          paddingHorizontal={16}
          paddingVertical={8}
          backgroundColor="rgba(255,255,255,0.12)"
        >
          <GraduationCap size={16} color={ACCENT} />
          <YStack flex={1}>
            <Text fontSize={13} fontWeight="700" color={ACCENT}>
              {t.ai.learning.badge}
            </Text>
            <Text fontSize={11} color="$textSecondary">
              {t.ai.learning.hint}
            </Text>
          </YStack>
          <Pressable
            onPress={() => chat.setMode('general')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.ai.learning.disableA11y}
          >
            <Text fontSize={13} fontWeight="700" color={ACCENT}>
              {t.ai.learning.exit}
            </Text>
          </Pressable>
        </XStack>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}
      >
        {isEmpty ? (
          <EmptyState onPickSuggestion={handleSuggestion} />
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <MessageBubble message={item} />}
            ListFooterComponent={showTyping ? <TypingBubble /> : <YStack height={8} />}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardDismissMode="interactive"
            onContentSizeChange={scrollToEnd}
          />
        )}

        {/* Bandeau d'erreur */}
        {chat.error ? (
          <XStack
            alignItems="center"
            gap={12}
            marginHorizontal={16}
            marginBottom={8}
            paddingHorizontal={14}
            paddingVertical={10}
            backgroundColor="rgba(239,68,68,0.15)"
            borderRadius={12}
          >
            <Text flex={1} color="#EF4444" fontSize={13}>
              {aiErrorMessage(chat.error)}
            </Text>
            <Pressable onPress={chat.clearError} hitSlop={8} accessibilityRole="button">
              <Text color="#EF4444" fontSize={13} fontWeight="700">
                {t.ai.errors.retry}
              </Text>
            </Pressable>
          </XStack>
        ) : null}

        {/* Rangée des photos jointes (E5-06) — au-dessus de la barre de saisie */}
        {attach.attachments.length > 0 ? (
          <XStack
            gap={8}
            paddingHorizontal={12}
            paddingTop={8}
            flexWrap="wrap"
            backgroundColor="$background"
          >
            {attach.attachments.map((a) => (
              <YStack key={a.localUri} width={64} height={64} position="relative">
                <Image source={{ uri: a.localUri }} style={styles.chip} contentFit="cover" />
                {a.status === 'uploading' ? (
                  <YStack style={styles.chipOverlay}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </YStack>
                ) : null}
                {a.status === 'failed' ? (
                  <YStack style={[styles.chipOverlay, styles.chipFailed]}>
                    <Text fontSize={20}>⚠️</Text>
                  </YStack>
                ) : null}
                <Pressable
                  onPress={() => attach.remove(a.localUri)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.ai.attach.removeA11y}
                  style={styles.chipRemove}
                >
                  <X size={12} color="#FFFFFF" />
                </Pressable>
              </YStack>
            ))}
          </XStack>
        ) : null}

        {/* Barre de saisie */}
        <XStack
          alignItems="flex-end"
          gap={8}
          paddingHorizontal={12}
          paddingTop={8}
          paddingBottom={insets.bottom > 0 ? insets.bottom : 10}
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderColor"
          backgroundColor="$background"
        >
          {/* Bouton ⊕ — menu des actions (maquette Canva). Ouvre AiPlusMenu. */}
          <Pressable
            onPress={() => setPlusMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.ai.menu.openA11y}
            style={styles.plusButton}
          >
            <Plus size={22} color="#FFFFFF" />
          </Pressable>
          <TextArea
            flex={1}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_INPUT_LENGTH}
            placeholder={t.ai.input.placeholder}
            placeholderTextColor="$placeholderColor"
            fontSize={15}
            lineHeight={20}
            color="$color"
            backgroundColor="$surface"
            borderWidth={0}
            borderRadius={20}
            paddingHorizontal={14}
            paddingVertical={10}
            maxHeight={120}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={chat.isStreaming ? t.ai.input.stopA11y : t.ai.input.sendA11y}
            style={[styles.sendButton, { backgroundColor: canSend ? ACCENT : '#2A2A2A' }]}
          >
            {chat.isStreaming ? (
              <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Send size={18} color={canSend ? '#000000' : '#6B6B6B'} />
            )}
          </Pressable>
        </XStack>
      </KeyboardAvoidingView>

      <AiConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeId={chat.conversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      <AiPlusMenu
        open={plusMenuOpen}
        onOpenChange={setPlusMenuOpen}
        learningActive={chat.mode === 'learning'}
        onOpenHistory={() => setDrawerOpen(true)}
        onToggleLearning={() => chat.setMode(chat.mode === 'learning' ? 'general' : 'learning')}
        onAddPhoto={() => void attach.pickAndUpload()}
      />
    </YStack>
  );
}

function EmptyState({ onPickSuggestion }: { onPickSuggestion: (text: string) => void }) {
  const t = useTranslations();
  const suggestions = [
    t.ai.suggestions.explain,
    t.ai.suggestions.summarize,
    t.ai.suggestions.ideas,
  ];

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap={14} paddingHorizontal={28}>
      <Sparkles size={56} color={ACCENT} strokeWidth={1.5} />
      <Text color="$color" fontSize={20} fontWeight="800" textAlign="center">
        {t.ai.empty.title}
      </Text>
      <Text color="$textSecondary" fontSize={14} textAlign="center" lineHeight={20}>
        {t.ai.empty.subtitle}
      </Text>
      <YStack gap={8} width="100%" marginTop={8}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPickSuggestion(s)}
            accessibilityRole="button"
            accessibilityLabel={s}
          >
            <XStack
              backgroundColor="$surface"
              borderRadius={12}
              paddingHorizontal={16}
              paddingVertical={13}
              alignItems="center"
              gap={10}
            >
              <SquarePen size={16} color="$textSecondary" />
              <Text flex={1} color="$color" fontSize={14}>
                {s}
              </Text>
            </XStack>
          </Pressable>
        ))}
      </YStack>
    </YStack>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  chipOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chipFailed: {
    backgroundColor: 'rgba(239,68,68,0.4)',
  },
  chipRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
