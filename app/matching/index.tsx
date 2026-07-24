// Écran de découverte — E13-06 (#356)
//
// « Ces personnes cherchent la même chose que toi ». Voir ADR-008 §2.4/§2.5.
//
// Parti pris produit : la recherche est pilotée par MES PROPRES INTENTIONS.
// On ne demande pas à l'utilisateur de re-saisir des critères : il choisit une
// de ses intentions et on lui montre les personnes qui correspondent. C'est ce
// qui distingue ce module d'une simple suggestion de profils.
//
// ⚠️ AUCUN swipe sur des visages (ADR-008 §2.5) : une liste de cartes centrées
// sur l'INTENTION. Si ça ressemble à Tinder, ça devient Tinder.

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { ArrowLeft, SlidersHorizontal, User as UserIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Spinner, Text, XStack, YStack } from 'tamagui';

import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import {
  useMatchingCandidates,
  type MatchingCandidate,
  type MatchingSearchParams,
} from '@/features/matching/hooks/useMatchingCandidates';
import { useMyIntents, type MatchingIntent } from '@/features/matching/hooks/useMatchingIntents';
import { classifyMatchingError, mapMatchingError } from '@/features/matching/lib/mapMatchingError';
import { VerifiedBadge } from '@/features/profile/components/VerifiedBadge';
import { useFollow } from '@/features/profile/hooks/useFollow';
import { useTranslations } from '@/i18n';

/** Bouton de mise en relation : réutilise intégralement le follow existant. */
function ConnectButton({ userId }: { userId: string }) {
  const t = useTranslations();
  const { status, isPending, follow } = useFollow(userId);

  if (status === 'self') return null;

  const label =
    status === 'following'
      ? t.matching.discovery.connected
      : status === 'pending'
        ? t.matching.discovery.pending
        : t.matching.discovery.connect;

  const done = status === 'following' || status === 'pending';

  return (
    <Button
      onPress={() => void follow()}
      disabled={done || isPending}
      opacity={done ? 0.6 : 1}
      backgroundColor={done ? '$surfaceElevated' : '$accentNeon'}
      color={done ? '$textSecondary' : '#000000'}
      fontWeight="700"
      fontSize={13}
      height={36}
      borderRadius="$10"
      paddingHorizontal={14}
    >
      {isPending ? <Spinner size="small" color="#000000" /> : label}
    </Button>
  );
}

function CandidateCard({
  candidate,
  subjectLabel,
  levelLabel,
}: {
  candidate: MatchingCandidate;
  subjectLabel: string;
  levelLabel: string;
}) {
  const t = useTranslations();

  // La carte met en avant l'INTENTION, pas le visage (ADR-008 §2.5).
  const intentLine =
    candidate.domain === 'scolaire'
      ? `${subjectLabel} · ${levelLabel}`
      : (candidate.tags ?? []).join(', ');

  return (
    <YStack backgroundColor="$surface" borderRadius={14} padding={14} gap={10} marginBottom={12}>
      {/* L'intention en premier, en gros */}
      <Text fontSize={15} fontWeight="800" color="$accentNeon">
        {t.matching.intent.direction[candidate.direction]} · {intentLine}
      </Text>

      {candidate.note ? (
        <Text fontSize={13} color="$textSecondary" lineHeight={18} numberOfLines={3}>
          {candidate.note}
        </Text>
      ) : null}

      {/* La personne ensuite, discrètement */}
      <XStack alignItems="center" gap={10}>
        <Pressable
          onPress={() => router.push(`/profile/${candidate.user_id}`)}
          accessibilityRole="button"
          accessibilityLabel={candidate.username}
        >
          <XStack alignItems="center" gap={8}>
            <YStack
              width={32}
              height={32}
              borderRadius={16}
              backgroundColor="$surfaceElevated"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {candidate.avatar_url ? (
                <Image source={{ uri: candidate.avatar_url }} style={{ width: 32, height: 32 }} />
              ) : (
                <UserIcon size={16} color="#A0A0A0" />
              )}
            </YStack>
            <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1}>
              @{candidate.username}
            </Text>
            <VerifiedBadge isVerified={candidate.is_verified} />
          </XStack>
        </Pressable>

        <YStack flex={1} />
        <ConnectButton userId={candidate.user_id} />
      </XStack>
    </YStack>
  );
}

export default function MatchingDiscoveryScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();

  const intentsQuery = useMyIntents();
  const subjectsQuery = useCourseSubjects();
  const levelsQuery = useCourseLevels();

  const myIntents = useMemo(
    () => (intentsQuery.data ?? []).filter((i) => i.is_active),
    [intentsQuery.data]
  );

  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);

  // Sélectionne la première intention dès qu'elles arrivent.
  useEffect(() => {
    if (selectedIntentId === null && myIntents.length > 0) {
      setSelectedIntentId(myIntents[0]?.id ?? null);
    }
  }, [myIntents, selectedIntentId]);

  const selectedIntent = useMemo(
    () => myIntents.find((i) => i.id === selectedIntentId) ?? null,
    [myIntents, selectedIntentId]
  );

  // Les critères de recherche viennent de MON intention.
  const searchParams: MatchingSearchParams | null = useMemo(() => {
    if (!selectedIntent) return null;
    return {
      domain: selectedIntent.domain,
      subjectCode: selectedIntent.subject_code,
      levelCode: selectedIntent.level_code,
      tags: selectedIntent.tags,
      direction: null, // « cherche » ET « propose »
    };
  }, [selectedIntent]);

  const candidatesQuery = useMatchingCandidates(searchParams);

  const candidates = useMemo(
    () => (candidatesQuery.data?.pages ?? []).flatMap((p) => p.candidates),
    [candidatesQuery.data]
  );

  const labelOf = useCallback(
    (list: { code: string; label: string }[] | undefined, code: string | null, fallback: string) =>
      code ? (list?.find((x) => x.code === code)?.label ?? code) : fallback,
    []
  );

  const intentChipLabel = useCallback(
    (intent: MatchingIntent) =>
      intent.domain === 'scolaire'
        ? labelOf(subjectsQuery.data, intent.subject_code, '—')
        : (intent.tags ?? []).slice(0, 2).join(', '),
    [labelOf, subjectsQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleLoadMore = useCallback(() => {
    if (candidatesQuery.hasNextPage && !candidatesQuery.isFetchingNextPage) {
      void candidatesQuery.fetchNextPage();
    }
  }, [candidatesQuery]);

  const errorMessage = candidatesQuery.isError
    ? mapMatchingError((candidatesQuery.error as Error)?.message)
    : null;
  // Les refus de garde-fou se règlent sur l'écran « Mes intentions ».
  const errorNeedsIntentScreen =
    candidatesQuery.isError &&
    classifyMatchingError((candidatesQuery.error as Error)?.message) !== 'generic';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
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
            accessibilityLabel={t.matching.back}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            {t.matching.discovery.title}
          </Text>
          <Pressable
            onPress={() => router.push('/matching/intent')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t.matching.discovery.manageIntents}
          >
            <SlidersHorizontal size={22} color="#FFFFFF" />
          </Pressable>
        </XStack>

        {intentsQuery.isLoading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" color="$accentNeon" />
          </YStack>
        ) : myIntents.length === 0 ? (
          /* Aucune intention → on renvoie vers la déclaration */
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$5" gap="$3">
            <Text fontSize={17} fontWeight="700" color="$color" textAlign="center">
              {t.matching.discovery.noIntent.title}
            </Text>
            <Text fontSize={14} color="$textSecondary" textAlign="center" lineHeight={20}>
              {t.matching.discovery.noIntent.subtitle}
            </Text>
            <Button
              onPress={() => router.push('/matching/intent')}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="800"
              height={46}
              borderRadius="$10"
              paddingHorizontal="$5"
              marginTop="$2"
            >
              {t.matching.discovery.noIntent.cta}
            </Button>
          </YStack>
        ) : errorMessage ? (
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$5" gap="$3">
            <Text fontSize={14} color="$textSecondary" textAlign="center" lineHeight={20}>
              {errorMessage}
            </Text>
            {errorNeedsIntentScreen ? (
              <Button
                onPress={() => router.push('/matching/intent')}
                backgroundColor="$accentNeon"
                color="#000000"
                fontWeight="800"
                height={46}
                borderRadius="$10"
                paddingHorizontal="$5"
              >
                {t.matching.discovery.errors.cta}
              </Button>
            ) : null}
          </YStack>
        ) : (
          <FlashList
            data={candidates}
            keyExtractor={(item) => item.intent_id}
            renderItem={({ item }) => (
              <CandidateCard
                candidate={item}
                subjectLabel={labelOf(subjectsQuery.data, item.subject_code, '—')}
                levelLabel={labelOf(levelsQuery.data, item.level_code, t.matching.intent.levelAny)}
              />
            )}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              <YStack gap={8} paddingBottom={12}>
                <Text
                  fontSize={12}
                  fontWeight="700"
                  color="$textSecondary"
                  textTransform="uppercase"
                >
                  {t.matching.discovery.pickIntent}
                </Text>
                <XStack flexWrap="wrap" gap={8}>
                  {myIntents.map((intent) => {
                    const selected = intent.id === selectedIntentId;
                    return (
                      <YStack
                        key={intent.id}
                        height={34}
                        paddingHorizontal={12}
                        borderRadius={17}
                        backgroundColor={selected ? '$accentNeon' : '$surface'}
                        alignItems="center"
                        justifyContent="center"
                        onPress={() => setSelectedIntentId(intent.id)}
                        pressStyle={{ scale: 0.97 }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          fontSize={13}
                          fontWeight="700"
                          color={selected ? '#000000' : '$textSecondary'}
                        >
                          {t.matching.intent.direction[intent.direction]} ·{' '}
                          {intentChipLabel(intent)}
                        </Text>
                      </YStack>
                    );
                  })}
                </XStack>
              </YStack>
            }
            ListEmptyComponent={
              candidatesQuery.isLoading ? (
                <YStack padding="$6" alignItems="center">
                  <Spinner color="$accentNeon" />
                </YStack>
              ) : (
                <YStack padding="$6" alignItems="center" gap="$2">
                  <Text fontSize={15} fontWeight="700" color="$color" textAlign="center">
                    {t.matching.discovery.empty.title}
                  </Text>
                  <Text fontSize={13} color="$textSecondary" textAlign="center" lineHeight={18}>
                    {t.matching.discovery.empty.subtitle}
                  </Text>
                </YStack>
              )
            }
            ListFooterComponent={
              candidatesQuery.isFetchingNextPage ? (
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
