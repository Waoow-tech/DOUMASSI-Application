// Écran Fiche ressource — E9-05 (#265)
//
// Détail d'une ressource : type + titre + matière·niveau + description +
// fichiers (ouvrables via WebBrowser) + carte auteur + CTA "Contacter
// l'auteur" (DM pré-rempli, réutilise useGetOrCreateDm de la messagerie).
//
// Garde-fou : sur sa propre ressource, le CTA devient "C'est votre ressource".

import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Eye,
  Flag,
  GraduationCap,
  MessageCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Image, Text, View, XStack, YStack } from 'tamagui';

import { ReportReasonSheet } from '@/features/cours/components/ReportReasonSheet';
import { ReputationBadge } from '@/features/cours/components/ReputationBadge';
import { ResourceFileRow } from '@/features/cours/components/ResourceFileRow';
import { useAuthorReputation } from '@/features/cours/hooks/useAuthorReputation';
import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import { useQuizByResource } from '@/features/cours/hooks/useQuizByResource';
import { useReportResource, type ReportReason } from '@/features/cours/hooks/useReportResource';
import { useResourceCommentCount } from '@/features/cours/hooks/useResourceComments';
import { useResourceDetail } from '@/features/cours/hooks/useResourceDetail';
import {
  RESOURCE_TYPE_LABEL,
  useToggleResourceBookmark,
} from '@/features/cours/hooks/useResources';
import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { VerifiedBadge } from '@/features/profile/components/VerifiedBadge';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

function formatRelativeFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const days = Math.floor(elapsed / 86_400_000);
  if (days < 1) return "aujourd'hui";
  if (days < 7) return `il y a ${days} j`;
  if (days < 31) return `il y a ${Math.floor(days / 7)} sem`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an`;
}

export default function ResourceDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const resourceId = typeof params.id === 'string' ? params.id : null;

  const { data: resource, isLoading, isError } = useResourceDetail(resourceId);
  const toggleBookmark = useToggleResourceBookmark();
  const getOrCreateDm = useGetOrCreateDm();
  const reportResource = useReportResource();
  const { data: quiz } = useQuizByResource(resourceId);
  const { data: reputation } = useAuthorReputation(resource?.author_id ?? null);
  const { data: commentCount } = useResourceCommentCount(resourceId);
  const levelsQuery = useCourseLevels();
  const subjectsQuery = useCourseSubjects();

  const [isReportOpen, setIsReportOpen] = useState(false);

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setMeId(data.session?.user.id ?? null);
    })();
  }, []);

  const isMine = meId !== null && resource != null && resource.author_id === meId;

  const levelLabel =
    levelsQuery.data?.find((l) => l.code === resource?.level_code)?.label ??
    resource?.level_code ??
    '';
  const subjectLabel =
    subjectsQuery.data?.find((s) => s.code === resource?.subject_code)?.label ??
    resource?.subject_code ??
    '';

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const handleToggleBookmark = useCallback(() => {
    if (!resourceId) return;
    toggleBookmark.mutate({ resourceId });
  }, [resourceId, toggleBookmark]);

  const handleOpenFile = useCallback((url: string) => {
    void WebBrowser.openBrowserAsync(url).catch((err) => {
      logger.warn('open resource file failed', { message: String(err) });
      Alert.alert('Impossible d’ouvrir le fichier', 'Réessaie dans un instant.');
    });
  }, []);

  const handleOpenAuthor = useCallback(() => {
    if (!resource) return;
    router.push(`/profile/${resource.author_id}`);
  }, [resource]);

  const handleSelectReportReason = useCallback(
    (reason: ReportReason) => {
      if (!resourceId) return;
      setIsReportOpen(false);
      reportResource.mutate(
        { resourceId, reason },
        {
          onSuccess: () => {
            Alert.alert('Merci', 'Ton signalement a bien été envoyé. Nous allons le vérifier.');
          },
          onError: (err) => {
            Alert.alert('Signalement impossible', err.message || 'Réessaie plus tard.');
          },
        }
      );
    },
    [reportResource, resourceId]
  );

  const handleContactAuthor = useCallback(() => {
    if (!resource || isMine) return;
    const prefill = `Bonjour, j'ai une question sur ta ressource '${resource.title}'.`;
    getOrCreateDm.mutate(resource.author_id, {
      onSuccess: (conversationId) => {
        router.push({ pathname: '/messages/[id]', params: { id: conversationId, prefill } });
      },
      onError: (err) => {
        logger.warn('contact author failed', { message: err.message });
        Alert.alert('Impossible de contacter l’auteur', err.message || 'Réessaie plus tard.');
      },
    });
  }, [getOrCreateDm, isMine, resource]);

  const renderHeader = (
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
      <Text flex={1} color="$color" fontSize={17} fontWeight="700" numberOfLines={1}>
        Ressource
      </Text>
      {resource ? (
        <Pressable
          onPress={handleToggleBookmark}
          disabled={toggleBookmark.isPending}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            resource.bookmarked_by_me ? 'Retirer des favoris' : 'Ajouter aux favoris'
          }
          accessibilityState={{ selected: resource.bookmarked_by_me }}
        >
          <Bookmark
            size={22}
            color={resource.bookmarked_by_me ? '#10D970' : '#FFFFFF'}
            fill={resource.bookmarked_by_me ? '#10D970' : 'transparent'}
            strokeWidth={2.2}
          />
        </Pressable>
      ) : null}
    </XStack>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {renderHeader}
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator color="#FFFFFF" />
          </YStack>
        </YStack>
      </>
    );
  }

  if (isError || !resource) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {renderHeader}
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal={24}
            gap={8}
          >
            <Text fontSize={16} fontWeight="700" color="$color">
              Ressource introuvable
            </Text>
            <Text fontSize={13} color="$textSecondary" textAlign="center">
              Elle a peut-être été supprimée ou masquée.
            </Text>
            <Button
              marginTop={12}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="700"
              borderRadius="$10"
              onPress={handleBack}
            >
              Retour
            </Button>
          </YStack>
        </YStack>
      </>
    );
  }

  const initial = (resource.author_username || '?').charAt(0).toUpperCase();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {renderHeader}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <YStack paddingHorizontal={16} paddingTop={16} gap={14}>
            {/* Badge type + matière·niveau */}
            <XStack alignItems="center" gap={8} flexWrap="wrap">
              <View
                backgroundColor="$surface"
                paddingHorizontal={10}
                paddingVertical={4}
                borderRadius={9999}
              >
                <Text fontSize={12} fontWeight="700" color="$accentNeon">
                  {RESOURCE_TYPE_LABEL[resource.type]}
                </Text>
              </View>
              <Text fontSize={13} color="$textSecondary">
                {subjectLabel} · {levelLabel}
              </Text>
            </XStack>

            {/* Titre */}
            <Text fontSize={22} fontWeight="800" color="$color">
              {resource.title}
            </Text>

            {/* Méta : vues + date */}
            <XStack alignItems="center" gap={12}>
              <XStack alignItems="center" gap={4}>
                <Eye size={13} color="#A0A0A0" />
                <Text fontSize={12} color="$textSecondary">
                  {resource.view_count} vue{resource.view_count > 1 ? 's' : ''}
                </Text>
              </XStack>
              <Text fontSize={12} color="$textSecondary">
                {formatRelativeFr(resource.created_at)}
              </Text>
            </XStack>

            {/* Description */}
            {resource.description ? (
              <YStack gap={6}>
                <Text fontSize={13} color="$textSecondary" fontWeight="700">
                  Description
                </Text>
                <Text fontSize={14} color="$color" lineHeight={20}>
                  {resource.description}
                </Text>
              </YStack>
            ) : null}

            {/* Fichiers */}
            {resource.files.length > 0 ? (
              <YStack gap={8}>
                <Text fontSize={13} color="$textSecondary" fontWeight="700">
                  Fichiers ({resource.files.length})
                </Text>
                {resource.files.map((url, i) => (
                  <ResourceFileRow
                    key={`${url}-${i}`}
                    url={url}
                    index={i}
                    onOpen={handleOpenFile}
                  />
                ))}
              </YStack>
            ) : (
              <Text fontSize={13} color="$textSecondary">
                Aucun fichier joint à cette ressource.
              </Text>
            )}

            {/* Quiz — passer (existe) / ajouter (le mien, pas encore) */}
            {quiz ? (
              <Pressable
                onPress={() => router.push(`/cours/quiz/${quiz.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Passer le quiz : ${quiz.title}`}
                style={styles.quizCard}
              >
                <XStack alignItems="center" gap={12}>
                  <View
                    width={40}
                    height={40}
                    borderRadius={10}
                    backgroundColor="#12291D"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <GraduationCap size={20} color="#10D970" />
                  </View>
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize={14} fontWeight="700" color="$color" numberOfLines={1}>
                      Passer le quiz
                    </Text>
                    <Text fontSize={12} color="$textSecondary">
                      {quiz.question_count} question{quiz.question_count > 1 ? 's' : ''}
                    </Text>
                  </YStack>
                  <ChevronRight size={18} color="#10D970" />
                </XStack>
              </Pressable>
            ) : isMine ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/cours/quiz-create',
                    params: {
                      resourceId: resource.id,
                      levelCode: resource.level_code,
                      subjectCode: resource.subject_code,
                      resourceTitle: resource.title,
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Ajouter un quiz à cette ressource"
                style={styles.quizAddCard}
              >
                <XStack alignItems="center" justifyContent="center" gap={8}>
                  <GraduationCap size={18} color="#10D970" />
                  <Text fontSize={14} fontWeight="700" color="$color">
                    Ajouter un quiz à cette ressource
                  </Text>
                </XStack>
              </Pressable>
            ) : null}

            {/* Carte auteur */}
            <YStack gap={8} paddingTop={4}>
              <Text fontSize={13} color="$textSecondary" fontWeight="700">
                Auteur
              </Text>
              <Pressable
                onPress={handleOpenAuthor}
                accessibilityRole="button"
                accessibilityLabel={`Voir le profil de ${resource.author_username}`}
              >
                <XStack
                  backgroundColor="$surface"
                  borderRadius={12}
                  padding={12}
                  alignItems="center"
                  gap={12}
                >
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={9999}
                    backgroundColor="$surfaceElevated"
                    overflow="hidden"
                    alignItems="center"
                    justifyContent="center"
                  >
                    {resource.author_avatar_url ? (
                      <Image
                        source={{ uri: resource.author_avatar_url }}
                        style={styles.avatar}
                        objectFit="cover"
                      />
                    ) : (
                      <Text fontSize={17} fontWeight="700" color="$color">
                        {initial}
                      </Text>
                    )}
                  </YStack>
                  <YStack flex={1} minWidth={0} gap={4}>
                    <XStack alignItems="center" gap={4}>
                      <Text fontSize={15} fontWeight="700" color="$color" numberOfLines={1}>
                        @{resource.author_username}
                      </Text>
                      <VerifiedBadge isVerified={resource.author_is_verified} />
                    </XStack>
                    {reputation && reputation.tier !== 'none' ? (
                      <View alignSelf="flex-start">
                        <ReputationBadge tier={reputation.tier} size="sm" />
                      </View>
                    ) : resource.author_full_name ? (
                      <Text fontSize={12} color="$textSecondary" numberOfLines={1}>
                        {resource.author_full_name}
                      </Text>
                    ) : null}
                  </YStack>
                  <ChevronRight size={16} color="#A0A0A0" />
                </XStack>
              </Pressable>
            </YStack>

            {/* Entraide — commentaires */}
            <Pressable
              onPress={() => router.push(`/cours/comments/${resource.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Entraide, ${commentCount ?? 0} commentaire${(commentCount ?? 0) > 1 ? 's' : ''}`}
              style={styles.entraideCard}
            >
              <XStack alignItems="center" gap={12}>
                <View
                  width={40}
                  height={40}
                  borderRadius={10}
                  backgroundColor="$surfaceElevated"
                  alignItems="center"
                  justifyContent="center"
                >
                  <MessageCircle size={20} color="#10D970" />
                </View>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={14} fontWeight="700" color="$color">
                    Entraide
                  </Text>
                  <Text fontSize={12} color="$textSecondary">
                    {commentCount ?? 0} commentaire{(commentCount ?? 0) > 1 ? 's' : ''}
                  </Text>
                </YStack>
                <ChevronRight size={18} color="#A0A0A0" />
              </XStack>
            </Pressable>

            {/* Signaler (pas sur sa propre ressource) */}
            {!isMine ? (
              <Pressable
                onPress={() => setIsReportOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Signaler cette ressource"
                style={styles.reportLink}
              >
                <XStack alignItems="center" justifyContent="center" gap={6}>
                  <Flag size={14} color="#A0A0A0" />
                  <Text fontSize={13} color="$textSecondary" fontWeight="600">
                    Signaler cette ressource
                  </Text>
                </XStack>
              </Pressable>
            ) : null}
          </YStack>
        </ScrollView>

        <ReportReasonSheet
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          onSelect={handleSelectReportReason}
          disabled={reportResource.isPending}
        />

        {/* CTA sticky bottom — Contacter l'auteur */}
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          paddingHorizontal={16}
          paddingTop={12}
          paddingBottom={insets.bottom + 12}
          backgroundColor="$background"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderColor"
        >
          {isMine ? (
            <View
              backgroundColor="$surface"
              borderRadius={9999}
              paddingVertical={14}
              alignItems="center"
            >
              <Text fontSize={14} fontWeight="700" color="$textSecondary">
                {`C'est votre ressource`}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleContactAuthor}
              disabled={getOrCreateDm.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Contacter ${resource.author_username}`}
              accessibilityState={{ disabled: getOrCreateDm.isPending }}
              style={[
                styles.cta,
                { backgroundColor: getOrCreateDm.isPending ? '#1A1A1A' : '#10D970' },
              ]}
            >
              {getOrCreateDm.isPending ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color="#000000">
                  Contacter l&apos;auteur
                </Text>
              )}
            </Pressable>
          )}
        </YStack>
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: '100%',
    height: '100%',
  },
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  quizAddCard: {
    borderWidth: 1,
    borderColor: '#2A3F33',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#12291D',
  },
  quizCard: {
    backgroundColor: '#12291D',
    borderRadius: 12,
    padding: 14,
  },
  entraideCard: {
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
  },
});
