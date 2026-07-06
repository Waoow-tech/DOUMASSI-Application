// Écran Apprendre — bibliothèque de ressources — E9-04 (#264)
//
// UI = "Apprendre" (le label large couvre cours + fiches + exos + annales),
// même si la tuile Business Hub garde "COURS" (cf brief §15.3).
//
// Navigation par niveau → matière → type + recherche live. Liste pleine
// largeur (contenu texte/document, plus lisible qu'une grille 2 colonnes).

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Bookmark, Check, Plus, Rss, Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, View, XStack, YStack } from 'tamagui';

import { ResourceCard } from '@/features/cours/components/ResourceCard';
import { TaxonomyChips } from '@/features/cours/components/TaxonomyChips';
import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import {
  followKey,
  useMyCoursFollows,
  useToggleCoursFollow,
} from '@/features/cours/hooks/useCoursFollows';
import {
  RESOURCE_TYPE_LABEL,
  useResources,
  useToggleResourceBookmark,
  type ResourceListItem,
  type ResourceType,
  type ResourcesFilters,
} from '@/features/cours/hooks/useResources';

const TYPE_OPTIONS = (Object.keys(RESOURCE_TYPE_LABEL) as ResourceType[]).map((t) => ({
  value: t,
  label: RESOURCE_TYPE_LABEL[t],
}));

export default function ApprendreScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ResourceListItem>>(null);

  const [levelCode, setLevelCode] = useState<string | null>(null);
  const [subjectCode, setSubjectCode] = useState<string | null>(null);
  const [type, setType] = useState<ResourceType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const levelsQuery = useCourseLevels();
  const subjectsQuery = useCourseSubjects();
  const { data: myFollows } = useMyCoursFollows();
  const toggleFollow = useToggleCoursFollow();

  // Suivi de la matière/niveau actuellement sélectionné (le plus spécifique
  // affiché = la matière si choisie, sinon le niveau).
  const activeFollow = useMemo<{
    kind: 'subject' | 'level';
    code: string;
    label: string;
  } | null>(() => {
    if (subjectCode) {
      const label = subjectsQuery.data?.find((s) => s.code === subjectCode)?.label ?? subjectCode;
      return { kind: 'subject', code: subjectCode, label };
    }
    if (levelCode) {
      const label = levelsQuery.data?.find((l) => l.code === levelCode)?.label ?? levelCode;
      return { kind: 'level', code: levelCode, label };
    }
    return null;
  }, [subjectCode, levelCode, subjectsQuery.data, levelsQuery.data]);

  const isFollowingActive = activeFollow
    ? (myFollows?.has(followKey(activeFollow.kind, activeFollow.code)) ?? false)
    : false;

  // Maps code → label pour résoudre l'affichage sur les cards.
  const levelLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    (levelsQuery.data ?? []).forEach((l) => m.set(l.code, l.label));
    return m;
  }, [levelsQuery.data]);

  const subjectLabelByCode = useMemo(() => {
    const m = new Map<string, string>();
    (subjectsQuery.data ?? []).forEach((s) => m.set(s.code, s.label));
    return m;
  }, [subjectsQuery.data]);

  const levelOptions = useMemo(
    () => (levelsQuery.data ?? []).map((l) => ({ value: l.code, label: l.label })),
    [levelsQuery.data]
  );
  const subjectOptions = useMemo(
    () => (subjectsQuery.data ?? []).map((s) => ({ value: s.code, label: s.label })),
    [subjectsQuery.data]
  );

  const filters = useMemo<ResourcesFilters>(
    () => ({ levelCode, subjectCode, type, search: searchQuery, sort: 'recent' }),
    [levelCode, subjectCode, type, searchQuery]
  );

  const resourcesQuery = useResources(filters);
  const toggleBookmark = useToggleResourceBookmark();

  const allResources = useMemo<ResourceListItem[]>(
    () => resourcesQuery.data?.pages.flatMap((p) => p.resources) ?? [],
    [resourcesQuery.data]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, []);

  const handleCardPress = useCallback((resourceId: string) => {
    router.push(`/cours/${resourceId}`);
  }, []);

  const handleToggleBookmark = useCallback(
    (resourceId: string) => {
      toggleBookmark.mutate({ resourceId });
    },
    [toggleBookmark]
  );

  const handleLoadMore = useCallback(() => {
    if (resourcesQuery.hasNextPage && !resourcesQuery.isFetchingNextPage) {
      void resourcesQuery.fetchNextPage();
    }
  }, [resourcesQuery]);

  const handlePullToRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    await resourcesQuery.refetch();
    setIsManualRefreshing(false);
  }, [resourcesQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ResourceListItem }) => (
      <View paddingHorizontal={12} paddingBottom={10}>
        <ResourceCard
          resource={item}
          levelLabel={levelLabelByCode.get(item.level_code) ?? item.level_code}
          subjectLabel={subjectLabelByCode.get(item.subject_code) ?? item.subject_code}
          onPress={() => handleCardPress(item.id)}
          onToggleBookmark={() => handleToggleBookmark(item.id)}
          isBookmarkPending={toggleBookmark.isPending}
        />
      </View>
    ),
    [
      levelLabelByCode,
      subjectLabelByCode,
      handleCardPress,
      handleToggleBookmark,
      toggleBookmark.isPending,
    ]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {/* Header */}
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
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text flex={1} color="$color" fontSize={18} fontWeight="700">
            Apprendre
          </Text>
          <Pressable
            onPress={() => router.push('/cours/feed')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Mon fil"
          >
            <Rss size={21} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/cours/bookmarks')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Mes ressources sauvegardées"
          >
            <Bookmark size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/cours/create')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Publier une ressource"
            style={styles.createButton}
          >
            <Plus size={20} color="#000000" strokeWidth={2.6} />
          </Pressable>
        </XStack>

        {/* Recherche */}
        <YStack paddingHorizontal={12} paddingTop={10} paddingBottom={4}>
          <XStack
            alignItems="center"
            gap={8}
            height={44}
            backgroundColor="$surface"
            borderRadius="$md"
            paddingHorizontal={12}
          >
            <Search size={18} color="#A0A0A0" />
            <Input
              flex={1}
              height={44}
              borderWidth={0}
              backgroundColor="transparent"
              color="$color"
              placeholder="Rechercher un cours, une fiche…"
              placeholderTextColor="$placeholderColor"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              fontSize={15}
              paddingHorizontal={0}
              accessibilityLabel="Rechercher une ressource"
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <X size={16} color="#A0A0A0" />
              </Pressable>
            ) : null}
          </XStack>
        </YStack>

        {/* Filtres taxonomie : matière → niveau → type */}
        <YStack gap={6} paddingVertical={4}>
          <TaxonomyChips
            options={subjectOptions}
            selected={subjectCode}
            onSelect={setSubjectCode}
            allLabel="Toutes matières"
          />
          <TaxonomyChips
            options={levelOptions}
            selected={levelCode}
            onSelect={setLevelCode}
            allLabel="Tous niveaux"
          />
          <TaxonomyChips
            options={TYPE_OPTIONS}
            selected={type}
            onSelect={(v) => setType(v as ResourceType | null)}
            allLabel="Tous types"
          />
        </YStack>

        {/* Suivre la matière/niveau sélectionné */}
        {activeFollow ? (
          <View paddingHorizontal={12} paddingBottom={6}>
            <Pressable
              onPress={() =>
                toggleFollow.mutate({ kind: activeFollow.kind, code: activeFollow.code })
              }
              accessibilityRole="button"
              accessibilityLabel={
                isFollowingActive
                  ? `Ne plus suivre ${activeFollow.label}`
                  : `Suivre ${activeFollow.label}`
              }
              accessibilityState={{ selected: isFollowingActive }}
              style={[styles.followPill, isFollowingActive ? styles.followPillOn : null]}
            >
              <XStack alignItems="center" justifyContent="center" gap={6}>
                {isFollowingActive ? (
                  <Check size={14} color="#000000" strokeWidth={2.6} />
                ) : (
                  <Rss size={14} color="#10D970" strokeWidth={2.4} />
                )}
                <Text
                  fontSize={13}
                  fontWeight="700"
                  color={isFollowingActive ? '#000000' : '$color'}
                >
                  {isFollowingActive
                    ? `Suivi · ${activeFollow.label}`
                    : `Suivre ${activeFollow.label}`}
                </Text>
              </XStack>
            </Pressable>
          </View>
        ) : null}

        {/* Liste */}
        <View flex={1}>
          {resourcesQuery.isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator color="#FFFFFF" />
            </YStack>
          ) : resourcesQuery.isError ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={8}
            >
              <Text fontSize={16} fontWeight="700" color="$color">
                Impossible de charger les ressources
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                Tire vers le bas pour réessayer.
              </Text>
            </YStack>
          ) : allResources.length === 0 ? (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={24}
              gap={8}
            >
              <Text fontSize={16} fontWeight="700" color="$color">
                Aucune ressource trouvée
              </Text>
              <Text fontSize={13} color="$textSecondary" textAlign="center">
                {searchQuery.length > 0
                  ? `Rien ne correspond à "${searchQuery}".`
                  : 'Sois le premier à partager un cours ici.'}
              </Text>
            </YStack>
          ) : (
            <FlashList
              ref={listRef}
              data={allResources}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
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
                resourcesQuery.isFetchingNextPage ? (
                  <YStack paddingVertical={16} alignItems="center">
                    <ActivityIndicator color="#FFFFFF" />
                  </YStack>
                ) : null
              }
            />
          )}
        </View>
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10D970',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: 24,
  },
  followPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#12291D',
    borderWidth: 1,
    borderColor: '#2A3F33',
  },
  followPillOn: {
    backgroundColor: '#10D970',
    borderColor: '#10D970',
  },
});
