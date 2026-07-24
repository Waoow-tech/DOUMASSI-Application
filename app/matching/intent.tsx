// Écran « Mes intentions » — E13-05 (#355)
//
// Déclaration de ce qu'on cherche / propose, et opt-in de visibilité.
// Voir ADR-008 §2.5/§2.6/§2.7.
//
// Rappel produit : le cœur de la mise en relation est l'INTENTION déclarée —
// pas un swipe sur des visages. Cet écran est donc la porte d'entrée du module.

import { router, Stack } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Spinner, Switch, Text, XStack, YStack } from 'tamagui';

import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import {
  useCreateIntent,
  useDeleteIntent,
  useMatchingOptIn,
  useMyIntents,
  type MatchingDirection,
  type MatchingDomain,
  type MatchingIntent,
} from '@/features/matching/hooks/useMatchingIntents';
import { useCurrentProfile } from '@/features/profile/hooks/useProfile';
import { useTranslations } from '@/i18n';

/** Puce de sélection réutilisée pour domaine / direction / matière / niveau. */
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <YStack
      height={36}
      paddingHorizontal={14}
      borderRadius={18}
      backgroundColor={selected ? '$accentNeon' : '$surface'}
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
      pressStyle={{ scale: 0.97 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text color={selected ? '#000000' : '$textSecondary'} fontSize={14} fontWeight="700">
        {label}
      </Text>
    </YStack>
  );
}

function IntentRow({
  intent,
  subjectLabel,
  levelLabel,
  onDelete,
}: {
  intent: MatchingIntent;
  subjectLabel: string;
  levelLabel: string;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const summary =
    intent.domain === 'scolaire'
      ? `${subjectLabel} · ${levelLabel}`
      : (intent.tags ?? []).join(', ');

  return (
    <XStack
      alignItems="center"
      gap={12}
      paddingVertical={12}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
    >
      <YStack flex={1} gap={2}>
        <Text fontSize={14} fontWeight="700" color="$color">
          {t.matching.intent.direction[intent.direction]} · {summary}
        </Text>
        {intent.note ? (
          <Text fontSize={12} color="$textSecondary" numberOfLines={2}>
            {intent.note}
          </Text>
        ) : null}
      </YStack>
      <Pressable
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t.matching.intent.delete}
      >
        <Trash2 size={18} color="#FF3B30" />
      </Pressable>
    </XStack>
  );
}

export default function MatchingIntentScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();

  const profileQuery = useCurrentProfile();
  const intentsQuery = useMyIntents();
  const subjectsQuery = useCourseSubjects();
  const levelsQuery = useCourseLevels();

  const createIntent = useCreateIntent();
  const deleteIntent = useDeleteIntent();
  const optInMutation = useMatchingOptIn();

  const [domain, setDomain] = useState<MatchingDomain>('scolaire');
  const [direction, setDirection] = useState<MatchingDirection>('cherche');
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const [levelCode, setLevelCode] = useState<string | null>(null); // null = tous niveaux
  const [tagsText, setTagsText] = useState('');
  const [note, setNote] = useState('');

  const optIn = profileQuery.data?.matching_opt_in ?? false;

  const tags = useMemo(
    () =>
      tagsText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [tagsText]
  );

  const labelOf = useCallback(
    (list: { code: string; label: string }[] | undefined, code: string | null, fallback: string) =>
      code ? (list?.find((x) => x.code === code)?.label ?? code) : fallback,
    []
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleAdd = useCallback(() => {
    if (domain === 'scolaire' && !subjectCode) {
      Alert.alert(t.matching.intent.errorTitle, t.matching.intent.errorSubjectRequired);
      return;
    }
    if (domain === 'business' && tags.length === 0) {
      Alert.alert(t.matching.intent.errorTitle, t.matching.intent.errorTagsRequired);
      return;
    }

    createIntent.mutate(
      { domain, direction, subjectCode, levelCode, tags, note },
      {
        onSuccess: () => {
          // Reset partiel : on garde domaine/direction pour enchaîner.
          setSubjectCode(null);
          setLevelCode(null);
          setTagsText('');
          setNote('');
        },
        onError: () => {
          Alert.alert(t.matching.intent.errorTitle, t.matching.intent.errorGeneric);
        },
      }
    );
  }, [domain, direction, subjectCode, levelCode, tags, note, createIntent, t]);

  const handleDelete = useCallback(
    (intentId: string) => {
      Alert.alert(t.matching.intent.deleteConfirmTitle, t.matching.intent.deleteConfirmMessage, [
        { text: t.matching.intent.cancel, style: 'cancel' },
        {
          text: t.matching.intent.delete,
          style: 'destructive',
          onPress: () => deleteIntent.mutate({ intentId }),
        },
      ]);
    },
    [deleteIntent, t]
  );

  const intents = intentsQuery.data ?? [];

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
            {t.matching.intent.title}
          </Text>
        </XStack>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text fontSize={13} color="$textSecondary" lineHeight={19}>
            {t.matching.intent.subtitle}
          </Text>

          {/* Opt-in — personne n'est visible sans ça */}
          <YStack backgroundColor="$surface" borderRadius={14} padding={16} gap={8}>
            <XStack alignItems="center" gap={12}>
              <Text flex={1} fontSize={15} fontWeight="700" color="$color">
                {t.matching.intent.optInLabel}
              </Text>
              <Switch
                size="$3"
                checked={optIn}
                disabled={optInMutation.isPending || profileQuery.isLoading}
                onCheckedChange={(value) => optInMutation.mutate({ optIn: value })}
                backgroundColor={optIn ? '$accentNeon' : '$surfaceElevated'}
                borderWidth={0}
              >
                <Switch.Thumb animation="quick" backgroundColor="white" />
              </Switch>
            </XStack>
            <Text fontSize={12} color="$textSecondary" lineHeight={17}>
              {t.matching.intent.optInHint}
            </Text>
          </YStack>

          {/* Domaine */}
          <YStack gap={8}>
            <Text fontSize={12} fontWeight="700" color="$textSecondary" textTransform="uppercase">
              {t.matching.intent.domainLabel}
            </Text>
            <XStack gap={8}>
              {(['scolaire', 'business'] as MatchingDomain[]).map((d) => (
                <Chip
                  key={d}
                  label={t.matching.intent.domain[d]}
                  selected={domain === d}
                  onPress={() => setDomain(d)}
                />
              ))}
            </XStack>
          </YStack>

          {/* Direction */}
          <YStack gap={8}>
            <Text fontSize={12} fontWeight="700" color="$textSecondary" textTransform="uppercase">
              {t.matching.intent.directionLabel}
            </Text>
            <XStack gap={8}>
              {(['cherche', 'propose'] as MatchingDirection[]).map((d) => (
                <Chip
                  key={d}
                  label={t.matching.intent.direction[d]}
                  selected={direction === d}
                  onPress={() => setDirection(d)}
                />
              ))}
            </XStack>
          </YStack>

          {domain === 'scolaire' ? (
            <>
              {/* Matière */}
              <YStack gap={8}>
                <Text
                  fontSize={12}
                  fontWeight="700"
                  color="$textSecondary"
                  textTransform="uppercase"
                >
                  {t.matching.intent.subjectLabel}
                </Text>
                <XStack flexWrap="wrap" gap={8}>
                  {(subjectsQuery.data ?? []).map((s) => (
                    <Chip
                      key={s.code}
                      label={s.label}
                      selected={subjectCode === s.code}
                      onPress={() => setSubjectCode(s.code)}
                    />
                  ))}
                </XStack>
              </YStack>

              {/* Niveau (null = tous niveaux) */}
              <YStack gap={8}>
                <Text
                  fontSize={12}
                  fontWeight="700"
                  color="$textSecondary"
                  textTransform="uppercase"
                >
                  {t.matching.intent.levelLabel}
                </Text>
                <XStack flexWrap="wrap" gap={8}>
                  <Chip
                    label={t.matching.intent.levelAny}
                    selected={levelCode === null}
                    onPress={() => setLevelCode(null)}
                  />
                  {(levelsQuery.data ?? []).map((l) => (
                    <Chip
                      key={l.code}
                      label={l.label}
                      selected={levelCode === l.code}
                      onPress={() => setLevelCode(l.code)}
                    />
                  ))}
                </XStack>
              </YStack>
            </>
          ) : (
            /* Tags business */
            <YStack gap={8}>
              <Text fontSize={12} fontWeight="700" color="$textSecondary" textTransform="uppercase">
                {t.matching.intent.tagsLabel}
              </Text>
              <Input
                value={tagsText}
                onChangeText={setTagsText}
                placeholder={t.matching.intent.tagsPlaceholder}
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
              <Text fontSize={12} color="$textSecondary">
                {t.matching.intent.tagsHint}
              </Text>
            </YStack>
          )}

          {/* Note */}
          <YStack gap={8}>
            <Text fontSize={12} fontWeight="700" color="$textSecondary" textTransform="uppercase">
              {t.matching.intent.noteLabel}
            </Text>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t.matching.intent.notePlaceholder}
              placeholderTextColor="$placeholderColor"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              backgroundColor="transparent"
              color="$color"
              height={44}
              paddingHorizontal="$3"
            />
          </YStack>

          <Button
            onPress={handleAdd}
            disabled={createIntent.isPending}
            backgroundColor="$accentNeon"
            color="#000000"
            fontWeight="800"
            fontSize={15}
            height={48}
            borderRadius="$10"
          >
            {createIntent.isPending ? (
              <Spinner size="small" color="#000000" />
            ) : (
              t.matching.intent.add
            )}
          </Button>

          {/* Mes intentions */}
          <YStack gap={4} marginTop={8}>
            <Text fontSize={12} fontWeight="700" color="$textSecondary" textTransform="uppercase">
              {t.matching.intent.listTitle}
            </Text>
            {intentsQuery.isLoading ? (
              <YStack padding={16} alignItems="center">
                <Spinner color="$accentNeon" />
              </YStack>
            ) : intents.length === 0 ? (
              <Text fontSize={13} color="$textSecondary" paddingVertical={12}>
                {t.matching.intent.empty}
              </Text>
            ) : (
              intents.map((intent) => (
                <IntentRow
                  key={intent.id}
                  intent={intent}
                  subjectLabel={labelOf(subjectsQuery.data, intent.subject_code, '—')}
                  levelLabel={labelOf(
                    levelsQuery.data,
                    intent.level_code,
                    t.matching.intent.levelAny
                  )}
                  onDelete={() => handleDelete(intent.id)}
                />
              ))
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </>
  );
}
