// Écran Envoyer des Dcoins — E12-05 (#329)
//
// Transfert P2P : choix du destinataire (recherche), montant, envoi.
// Voir ADR-005. S'appuie sur la RPC `wallet_transfer` (E12-02) qui écrit les
// deux legs (-X émetteur / +X récepteur) atomiquement.

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User as UserIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import { useProfilesByIds } from '@/features/profile/hooks/useProfilesByIds';
import { useSearchUsers, type SearchUserResult } from '@/features/profile/hooks/useSearchUsers';
import { useWallet, useWalletTransfer, newIdempotencyKey } from '@/features/wallet/hooks/useWallet';
import { mapWalletError } from '@/features/wallet/lib/mapWalletError';
import { useTranslations } from '@/i18n';

function RecipientRow({
  user,
  onPress,
}: {
  user: SearchUserResult;
  onPress: (u: SearchUserResult) => void;
}) {
  return (
    <XStack
      height={64}
      alignItems="center"
      paddingHorizontal={16}
      gap={12}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
      onPress={() => onPress(user)}
      pressStyle={{ opacity: 0.7 }}
      cursor="pointer"
    >
      <YStack
        width={40}
        height={40}
        borderRadius={20}
        backgroundColor="$surfaceElevated"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={{ width: 40, height: 40 }} />
        ) : (
          <UserIcon size={20} color="#A0A0A0" />
        )}
      </YStack>
      <YStack flex={1}>
        <Text fontSize={15} fontWeight="600" color="$color" numberOfLines={1}>
          {user.full_name ?? `@${user.username}`}
        </Text>
        <Text fontSize={12} color="$textSecondary" numberOfLines={1}>
          @{user.username}
        </Text>
      </YStack>
    </XStack>
  );
}

export default function WalletSendScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();

  // Mode pourboire (E12-06) : `?to=<userId>&tip=1` depuis la carte auteur d'un
  // cours. Le destinataire est alors pré-rempli et l'étape de recherche sautée.
  const params = useLocalSearchParams<{ to?: string; tip?: string }>();
  const presetToId = typeof params.to === 'string' && params.to.length > 0 ? params.to : null;
  const isTip = params.tip === '1';

  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState<SearchUserResult | null>(null);
  const [amountText, setAmountText] = useState('');

  const walletQuery = useWallet();
  const searchQuery = useSearchUsers(query);
  const transfer = useWalletTransfer();

  // Résout le destinataire pré-rempli (username/avatar) à partir de son id.
  const { profilesById } = useProfilesByIds(presetToId ? [presetToId] : []);

  useEffect(() => {
    if (!presetToId) return;
    const p = profilesById.get(presetToId);
    if (!p) return;
    setRecipient((current) =>
      current?.id === p.id
        ? current
        : {
            id: p.id,
            username: p.username,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            is_verified: false,
          }
    );
  }, [presetToId, profilesById]);

  const balance = walletQuery.data ?? 0;
  const amount = useMemo(() => {
    const n = parseInt(amountText, 10);
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);

  // Clé d'idempotence de la TENTATIVE en cours.
  //
  // Générée une seule fois, puis CONSERVÉE tant que l'opération ne change pas :
  // si l'envoi échoue (réseau), réappuyer rejoue la MÊME clé => le serveur
  // neutralise le doublon au lieu de débiter deux fois.
  // Réinitialisée si le destinataire ou le montant change (autre opération), et
  // après un succès (le prochain envoi est un nouveau mouvement).
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [recipient?.id, amount]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/wallet');
  }, []);

  const handlePickRecipient = useCallback((user: SearchUserResult) => {
    setRecipient(user);
    setQuery('');
  }, []);

  const canSubmit = recipient !== null && amount > 0 && amount <= balance && !transfer.isPending;

  const handleSend = useCallback(() => {
    if (!recipient || amount <= 0) return;

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    transfer.mutate(
      { toUserId: recipient.id, amount, idempotencyKey: idempotencyKeyRef.current, isTip },
      {
        onSuccess: () => {
          // Succès : le prochain envoi doit être un nouveau mouvement.
          idempotencyKeyRef.current = null;
          const copy = isTip ? t.wallet.tip : t.wallet.send;
          Alert.alert(copy.successTitle, copy.successMessage(amount, recipient.username));
          router.back();
        },
        onError: (err) => {
          // On CONSERVE la clé : un nouvel appui rejoue la même opération.
          Alert.alert(t.wallet.send.errorTitle, mapWalletError(err.message));
        },
      }
    );
  }, [recipient, amount, transfer, t, isTip]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {/* En-tête */}
        <XStack
          height={56}
          paddingHorizontal={12}
          alignItems="center"
          gap={12}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.wallet.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            {isTip ? t.wallet.tip.title : t.wallet.send.title}
          </Text>
        </XStack>

        {recipient === null ? (
          /* --- Étape 1 : choisir le destinataire --- */
          <YStack flex={1}>
            <YStack padding={16}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={t.wallet.send.searchPlaceholder}
                placeholderTextColor="$placeholderColor"
                autoCapitalize="none"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$4"
                backgroundColor="transparent"
                color="$color"
                height={44}
                paddingHorizontal="$3"
              />
            </YStack>

            {!searchQuery.canSearch ? (
              <YStack padding="$5" alignItems="center">
                <Text fontSize={13} color="$textSecondary" textAlign="center">
                  {t.wallet.send.searchHint}
                </Text>
              </YStack>
            ) : searchQuery.isLoading ? (
              <YStack padding="$5" alignItems="center">
                <Spinner color="$accentNeon" />
              </YStack>
            ) : (
              <FlashList
                data={searchQuery.users}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <RecipientRow user={item} onPress={handlePickRecipient} />
                )}
                ListEmptyComponent={
                  <YStack padding="$5" alignItems="center">
                    <Text fontSize={13} color="$textSecondary">
                      {t.wallet.send.noResults}
                    </Text>
                  </YStack>
                }
                contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              />
            )}
          </YStack>
        ) : (
          /* --- Étape 2 : montant + envoi --- */
          <YStack flex={1} padding={20} gap="$4">
            <YStack gap="$2">
              <Text fontSize={12} color="$textSecondary" fontWeight="600" textTransform="uppercase">
                {t.wallet.send.recipientLabel}
              </Text>
              <XStack
                backgroundColor="$surface"
                borderRadius={12}
                padding={12}
                alignItems="center"
                gap={12}
              >
                <YStack
                  width={40}
                  height={40}
                  borderRadius={20}
                  backgroundColor="$surfaceElevated"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                >
                  {recipient.avatar_url ? (
                    <Image
                      source={{ uri: recipient.avatar_url }}
                      style={{ width: 40, height: 40 }}
                    />
                  ) : (
                    <UserIcon size={20} color="#A0A0A0" />
                  )}
                </YStack>
                <Text flex={1} fontSize={15} fontWeight="600" color="$color" numberOfLines={1}>
                  @{recipient.username}
                </Text>
                {/* En mode pourboire le destinataire est imposé (l'auteur du
                    cours) : pas de « Changer ». */}
                {presetToId ? null : (
                  <Text
                    fontSize={13}
                    color="$accentNeon"
                    fontWeight="700"
                    onPress={() => setRecipient(null)}
                    pressStyle={{ opacity: 0.7 }}
                    cursor="pointer"
                  >
                    {t.wallet.send.change}
                  </Text>
                )}
              </XStack>
            </YStack>

            <YStack gap="$2">
              <Text fontSize={12} color="$textSecondary" fontWeight="600" textTransform="uppercase">
                {t.wallet.send.amountLabel}
              </Text>
              <Input
                value={amountText}
                onChangeText={(text) => setAmountText(text.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor="$placeholderColor"
                keyboardType="number-pad"
                borderWidth={1}
                borderColor={amount > balance ? '$danger' : '$borderColor'}
                borderRadius="$4"
                backgroundColor="transparent"
                color="$color"
                fontSize={24}
                fontWeight="800"
                height={56}
                paddingHorizontal="$3"
              />
              <Text fontSize={12} color={amount > balance ? '$danger' : '$textSecondary'}>
                {t.wallet.send.available(balance)}
              </Text>
            </YStack>

            <Button
              onPress={handleSend}
              disabled={!canSubmit}
              opacity={canSubmit ? 1 : 0.5}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="800"
              fontSize={16}
              height={50}
              borderRadius="$10"
              marginTop="$2"
            >
              {transfer.isPending ? <Spinner size="small" color="#000000" /> : t.wallet.send.submit}
            </Button>
          </YStack>
        )}
      </YStack>
    </>
  );
}
