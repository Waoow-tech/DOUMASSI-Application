// Écran « Nouvelle conversation » — DM et Groupe (ticket #212).
//
// Toggle en tête pour basculer entre :
//   - DM (défaut, comportement existant)   : tap user → ouvre/crée DM
//   - Groupe (ticket #212)                 : champ nom + multi-select +
//                                            bouton Créer → RPC
//                                            create_group_conversation
//
// La RPC valide côté serveur (nom non vide, ≥1 participant, pas de blocage
// bilatéral). On bloque côté client le bouton Créer si nom vide ou aucun
// participant pour éviter l'aller-retour réseau inutile.

import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { AlertCircle, ArrowLeft, Search, Users, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import { useCreateGroupConversation } from '@/features/messaging/hooks/useCreateGroupConversation';
import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { UserRow } from '@/features/profile/components/UserRow';
import { type SearchUserResult, useSearchUsers } from '@/features/profile/hooks/useSearchUsers';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';

type Mode = 'dm' | 'group';

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

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const t = useTranslations();
  return (
    <XStack
      gap="$1"
      padding={4}
      backgroundColor="$surface"
      borderRadius="$10"
      marginHorizontal="$4"
      marginTop="$3"
    >
      {(['dm', 'group'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="button"
          accessibilityLabel={
            m === 'dm'
              ? t.messaging.newConversation.toggleDmA11y
              : t.messaging.newConversation.toggleGroupA11y
          }
          accessibilityState={{ selected: mode === m }}
          style={[styles.toggleChip, mode === m ? styles.toggleChipActive : null]}
        >
          <Text
            color={mode === m ? '#000000' : '$color'}
            fontSize={14}
            fontWeight={mode === m ? '700' : '500'}
          >
            {m === 'dm'
              ? t.messaging.newConversation.toggleDmLabel
              : t.messaging.newConversation.toggleGroupLabel}
          </Text>
        </Pressable>
      ))}
    </XStack>
  );
}

export default function NewMessageRoute() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('dm');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<SearchUserResult[]>([]);

  const { users, debouncedQuery, canSearch, isLoading, isError } = useSearchUsers(query);
  const getOrCreateDm = useGetOrCreateDm();
  const createGroup = useCreateGroupConversation();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, []);

  const handleSelectUserDm = useCallback(
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

  const handleToggleParticipant = useCallback((user: SearchUserResult) => {
    setSelectedParticipants((prev) =>
      prev.some((p) => p.id === user.id) ? prev.filter((p) => p.id !== user.id) : [...prev, user]
    );
  }, []);

  const handleCreateGroup = useCallback(() => {
    createGroup.mutate(
      {
        name: groupName,
        participantIds: selectedParticipants.map((u) => u.id),
      },
      {
        onSuccess: (conversationId) => {
          router.replace(`/messages/${conversationId}`);
        },
        onError: (err) => {
          logger.warn('Create group failed', { message: err.message });
        },
      }
    );
  }, [createGroup, groupName, selectedParticipants]);

  const renderUser = useCallback(
    ({ item }: { item: SearchUserResult }) => {
      if (mode === 'dm') {
        return (
          <UserRow
            user={item}
            onPress={() => handleSelectUserDm(item)}
            rightSlot={selectedUserId === item.id ? <Spinner size="small" color="$color" /> : null}
          />
        );
      }
      const isSelected = selectedParticipants.some((p) => p.id === item.id);
      return (
        <UserRow
          user={item}
          onPress={() => handleToggleParticipant(item)}
          rightSlot={
            isSelected ? (
              <XStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor="$accentNeon"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={14} color="#000000" fontWeight="700">
                  ✓
                </Text>
              </XStack>
            ) : null
          }
        />
      );
    },
    [mode, selectedUserId, selectedParticipants, handleSelectUserDm, handleToggleParticipant]
  );

  const keyExtractor = useCallback((item: SearchUserResult) => item.id, []);
  const showEmptyState = !canSearch;
  const showNoResults = canSearch && !isLoading && !isError && users.length === 0;

  const canCreateGroup = useMemo(
    () =>
      mode === 'group' &&
      groupName.trim().length > 0 &&
      selectedParticipants.length > 0 &&
      !createGroup.isPending,
    [createGroup.isPending, groupName, mode, selectedParticipants.length]
  );

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
            {mode === 'dm'
              ? t.messaging.newConversation.titleDm
              : t.messaging.newConversation.titleGroup}
          </Text>
        </XStack>

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === 'group' ? (
          <YStack paddingHorizontal="$4" paddingTop="$3" gap="$2">
            <Input
              placeholder={t.messaging.newConversation.groupNamePlaceholder}
              placeholderTextColor="$placeholderColor"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={80}
              backgroundColor="$surface"
              borderWidth={0}
              borderRadius="$md"
              color="$color"
              height={44}
              paddingHorizontal="$3"
              fontSize={15}
              accessibilityLabel={t.messaging.newConversation.groupNameA11y}
            />
            {selectedParticipants.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
              >
                <XStack gap="$2" paddingVertical="$2">
                  {selectedParticipants.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => handleToggleParticipant(p)}
                      accessibilityRole="button"
                      accessibilityLabel={t.messaging.newConversation.removeParticipantA11y(
                        p.username
                      )}
                      style={styles.chip}
                    >
                      <Text color="#FFFFFF" fontSize={13} fontWeight="600">
                        @{p.username}
                      </Text>
                      <X size={14} color="#FFFFFF" />
                    </Pressable>
                  ))}
                </XStack>
              </ScrollView>
            ) : null}
          </YStack>
        ) : null}

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
              flex={1}
              height={48}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder={
                mode === 'dm'
                  ? t.messaging.newConversation.searchUserPlaceholder
                  : t.messaging.newConversation.addMembersPlaceholder
              }
              placeholderTextColor="$placeholderColor"
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={setQuery}
              paddingHorizontal={0}
              fontSize={16}
              accessibilityLabel={
                mode === 'dm'
                  ? t.messaging.newConversation.searchUserA11y
                  : t.messaging.newConversation.searchGroupA11y
              }
            />
            {query.length > 0 ? (
              <Button
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

        {showEmptyState ? (
          <SearchState
            icon="search"
            title={
              mode === 'dm'
                ? t.messaging.common.searchByUsernameOrName
                : t.messaging.newConversation.searchHintGroup
            }
          />
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
            data={users}
            renderItem={renderUser}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {mode === 'group' ? (
          <YStack
            paddingHorizontal="$4"
            paddingTop="$2"
            paddingBottom={insets.bottom + 12}
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderColor"
            backgroundColor="$background"
          >
            {createGroup.isError ? (
              <Text color="$danger" fontSize={13} marginBottom="$2" textAlign="center">
                {createGroup.error?.message ??
                  t.messaging.newConversation.createGroupFailedFallback}
              </Text>
            ) : null}
            <Button
              onPress={handleCreateGroup}
              disabled={!canCreateGroup}
              backgroundColor={canCreateGroup ? '$accentNeon' : '$surface'}
              color={canCreateGroup ? '#000000' : '$textSecondary'}
              fontWeight="700"
              size="$5"
              borderRadius="$10"
              accessibilityRole="button"
              accessibilityLabel={t.messaging.newConversation.createGroupA11y}
              accessibilityState={{ disabled: !canCreateGroup }}
            >
              <Users size={18} color={canCreateGroup ? '#000000' : '#A0A0A0'} />
              <Text
                fontSize={15}
                fontWeight="700"
                color={canCreateGroup ? '#000000' : '$textSecondary'}
              >
                {createGroup.isPending
                  ? t.messaging.newConversation.creating
                  : t.messaging.newConversation.createGroupButton(selectedParticipants.length)}
              </Text>
            </Button>
          </YStack>
        ) : null}
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
  },
  chipsScroll: {
    maxHeight: 50,
  },
  listContent: {
    paddingBottom: 24,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleChipActive: {
    backgroundColor: '#FFFFFF',
  },
});
