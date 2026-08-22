// Écran Portefeuille — E12-04 (#328)
//
// Solde Dcoins + historique du grand livre. Voir ADR-005.
// Lecture seule : les mouvements se font depuis E12-05 (P2P) et E12-06 (dépense).

import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';

import {
  useWallet,
  useWalletTransactions,
  type WalletTransaction,
} from '@/features/wallet/hooks/useWallet';
import { useTranslations } from '@/i18n';
import { useLanguageStore } from '@/stores/languageStore';

const ROW_HEIGHT = 68;

function TransactionRow({ tx, locale }: { tx: WalletTransaction; locale: string }) {
  const t = useTranslations();
  const isCredit = tx.amount > 0;

  const date = useMemo(() => {
    const d = new Date(tx.created_at);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }, [tx.created_at, locale]);

  return (
    <XStack
      height={ROW_HEIGHT}
      alignItems="center"
      paddingHorizontal={16}
      gap={12}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
    >
      <YStack flex={1} gap={2}>
        <Text fontSize={15} fontWeight="600" color="$color" numberOfLines={1}>
          {t.wallet.txType[tx.type]}
        </Text>
        <Text fontSize={12} color="$textSecondary">
          {date}
        </Text>
      </YStack>

      {/* Le signe vient du montant lui-même (négatif = débit) ; on n'ajoute
          explicitement que le '+' des crédits. */}
      <Text fontSize={16} fontWeight="800" color={isCredit ? '$accentNeon' : '$color'}>
        {isCredit ? '+' : ''}
        {tx.amount}
      </Text>
    </XStack>
  );
}

export default function WalletScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((state) => state.language);
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  const walletQuery = useWallet();
  const txQuery = useWalletTransactions();

  const transactions = useMemo(
    () => (txQuery.data?.pages ?? []).flatMap((p) => p.transactions),
    [txQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleLoadMore = useCallback(() => {
    if (txQuery.hasNextPage && !txQuery.isFetchingNextPage) {
      void txQuery.fetchNextPage();
    }
  }, [txQuery]);

  const handleRefresh = useCallback(() => {
    void walletQuery.refetch();
    void txQuery.refetch();
  }, [walletQuery, txQuery]);

  const hasError = walletQuery.isError || txQuery.isError;

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
            {t.wallet.title}
          </Text>
        </XStack>

        {hasError ? (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$5">
            <Text color="$textSecondary" fontSize={14} textAlign="center">
              {t.wallet.error.title}
            </Text>
            <Button
              onPress={handleRefresh}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="700"
              borderRadius="$10"
              height={44}
              paddingHorizontal="$5"
            >
              {t.wallet.error.retry}
            </Button>
          </YStack>
        ) : (
          <FlashList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TransactionRow tx={item} locale={locale} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={walletQuery.isRefetching && txQuery.isRefetching}
                onRefresh={handleRefresh}
                tintColor="#FFFFFF"
              />
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              <YStack padding={20} gap="$4">
                {/* Carte de solde */}
                <YStack
                  backgroundColor="$surface"
                  borderRadius={16}
                  padding={20}
                  alignItems="center"
                  gap={4}
                >
                  <Text fontSize={13} color="$textSecondary" fontWeight="600">
                    {t.wallet.balanceLabel}
                  </Text>
                  {walletQuery.isLoading ? (
                    <Spinner size="large" color="$accentNeon" />
                  ) : (
                    <XStack alignItems="baseline" gap={6}>
                      <Text
                        fontSize={40}
                        fontWeight="800"
                        color="$accentNeon"
                        fontFamily="$heading"
                      >
                        {walletQuery.data ?? 0}
                      </Text>
                      <Text fontSize={16} fontWeight="700" color="$textSecondary">
                        {t.wallet.unit}
                      </Text>
                    </XStack>
                  )}
                </YStack>

                {/* Envoyer des Dcoins (E12-05) */}
                <Button
                  onPress={() => router.push('/wallet/send')}
                  backgroundColor="$accentNeon"
                  color="#000000"
                  fontWeight="800"
                  fontSize={15}
                  height={48}
                  borderRadius="$10"
                  icon={<Send size={18} color="#000000" />}
                >
                  {t.wallet.send.cta}
                </Button>

                <Text
                  fontSize={13}
                  color="$textSecondary"
                  fontWeight="600"
                  textTransform="uppercase"
                >
                  {t.wallet.historyTitle}
                </Text>
              </YStack>
            }
            ListEmptyComponent={
              txQuery.isLoading ? (
                <YStack padding="$6" alignItems="center">
                  <Spinner color="$accentNeon" />
                </YStack>
              ) : (
                <YStack padding="$6" alignItems="center" gap="$2">
                  <Text fontSize={15} fontWeight="700" color="$color">
                    {t.wallet.empty.title}
                  </Text>
                  <Text fontSize={13} color="$textSecondary" textAlign="center">
                    {t.wallet.empty.subtitle}
                  </Text>
                </YStack>
              )
            }
            ListFooterComponent={
              txQuery.isFetchingNextPage ? (
                <YStack padding="$4" alignItems="center">
                  <Spinner color="$accentNeon" />
                </YStack>
              ) : null
            }
          />
        )}
      </YStack>
    </>
  );
}
