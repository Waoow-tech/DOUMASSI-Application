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
import { useToggleResourceBookmark } from '@/features/cours/hooks/useResources';
import { useGetOrCreateDm } from '@/features/messaging/hooks/useGetOrCreateDm';
import { VerifiedBadge } from '@/features/profile/components/VerifiedBadge';
import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Date relative de publication (langue courante lue à l'appel via getT).
function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = getT().cours.detail.time;
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const days = Math.floor(elapsed / 86_400_000);
  if (days < 1) return time.today;
  if (days < 7) return time.days(days);
  if (days < 31) return time.weeks(Math.floor(days / 7));
  if (days < 365) return time.months(Math.floor(days / 30));
  return time.years(Math.floor(days / 365));
}

export default function ResourceDetailScreen() {
  const t = useTranslations();
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

  const handleOpenFile = useCallback(
    (url: string) => {
      void WebBrowser.openBrowserAsync(url).catch((err) => {
        logger.warn('open resource file failed', { message: String(err) });
        Alert.alert(t.cours.detail.openFileErrorTitle, t.cours.detail.openFileErrorMessage);
      });
    },
    [t]
  );

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
            Alert.alert(t.cours.detail.reportSuccessTitle, t.cours.detail.reportSuccessMessage);
          },
          onError: (err) => {
            Alert.alert(
              t.cours.detail.reportErrorTitle,
              err.message || t.cours.detail.reportErrorFallback
            );
          },
        }
      );
    },
    [reportResource, resourceId, t]
  );

  const handleContactAuthor = useCallback(() => {
    if (!resource || isMine) return;
    const prefill = t.cours.detail.contactPrefill(resource.title);
    getOrCreateDm.mutate(resource.author_id, {
      onSuccess: (conversationId) => {
        router.push({ pathname: '/messages/[id]', params: { id: conversationId, prefill } });
      },
      onError: (err) => {
        logger.warn('contact author failed', { message: err.message });
        Alert.alert(
          t.cours.detail.contactErrorTitle,
          err.message || t.cours.detail.contactErrorFallback
        );
      },
    });
  }, [getOrCreateDm, isMine, resource, t]);

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
        accessibilityLabel={t.cours.common.back}
      >
        <ArrowLeft size={24} color="#FFFFFF" />
      </Pressable>
      <Text flex={1} color="$color" fontSize={17} fontWeight="700" numberOfLines={1}>
        {t.cours.detail.title}
      </Text>
      {resource ? (
        <Pressable
          onPress={handleToggleBookmark}
          disabled={toggleBookmark.isPending}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={
            resource.bookmarked_by_me ? t.cours.bookmark.remove : t.cours.bookmark.add
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
              {t.cours.detail.notFoundTitle}
            </Text>
            <Text fontSize={13} color="$textSecondary" textAlign="center">
              {t.cours.detail.notFoundSubtitle}
            </Text>
            <Button
              marginTop={12}
              backgroundColor="$accentNeon"
              color="#000000"
              fontWeight="700"
              borderRadius="$10"
              onPress={handleBack}
            >
              {t.cours.common.back}
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
                  {t.cours.resourceType[resource.type]}
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
                  {t.cours.detail.views(resource.view_count)}
                </Text>
              </XStack>
              <Text fontSize={12} color="$textSecondary">
                {formatRelative(resource.created_at)}
              </Text>
            </XStack>

            {/* Description */}
            {resource.description ? (
              <YStack gap={6}>
                <Text fontSize={13} color="$textSecondary" fontWeight="700">
                  {t.cours.detail.descriptionLabel}
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
                  {t.cours.detail.filesLabel(resource.files.length)}
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
                {t.cours.detail.noFiles}
              </Text>
            )}

            {/* Quiz — passer (existe) / ajouter (le mien, pas encore) */}
            {quiz ? (
              <Pressable
                onPress={() => router.push(`/cours/quiz/${quiz.id}`)}
                accessibilityRole="button"
                accessibilityLabel={t.cours.detail.takeQuizA11y(quiz.title)}
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
                      {t.cours.detail.takeQuiz}
                    </Text>
                    <Text fontSize={12} color="$textSecondary">
                      {t.cours.detail.questionCount(quiz.question_count)}
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
                accessibilityLabel={t.cours.detail.addQuiz}
                style={styles.quizAddCard}
              >
                <XStack alignItems="center" justifyContent="center" gap={8}>
                  <GraduationCap size={18} color="#10D970" />
                  <Text fontSize={14} fontWeight="700" color="$color">
                    {t.cours.detail.addQuiz}
                  </Text>
                </XStack>
              </Pressable>
            ) : null}

            {/* Carte auteur */}
            <YStack gap={8} paddingTop={4}>
              <Text fontSize={13} color="$textSecondary" fontWeight="700">
                {t.cours.detail.authorLabel}
              </Text>
              <Pressable
                onPress={handleOpenAuthor}
                accessibilityRole="button"
                accessibilityLabel={t.cours.detail.viewProfileA11y(resource.author_username)}
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
              accessibilityLabel={t.cours.detail.entraideA11y(commentCount ?? 0)}
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
                    {t.cours.detail.entraide}
                  </Text>
                  <Text fontSize={12} color="$textSecondary">
                    {t.cours.detail.commentCount(commentCount ?? 0)}
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
                accessibilityLabel={t.cours.detail.report}
                style={styles.reportLink}
              >
                <XStack alignItems="center" justifyContent="center" gap={6}>
                  <Flag size={14} color="#A0A0A0" />
                  <Text fontSize={13} color="$textSecondary" fontWeight="600">
                    {t.cours.detail.report}
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
                {t.cours.detail.ownResource}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleContactAuthor}
              disabled={getOrCreateDm.isPending}
              accessibilityRole="button"
              accessibilityLabel={t.cours.detail.contactAuthorA11y(resource.author_username)}
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
                  {t.cours.detail.contactAuthor}
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
