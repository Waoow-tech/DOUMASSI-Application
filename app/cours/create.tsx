// Écran Création de ressource — E9-06 (#266)
//
// Publier un cours / fiche / exo / annale : type + niveau + matière + titre +
// description + fichiers (PDF/images). RHF + Zod. Pipeline submit identique à
// la marketplace : valider → upload séquentiel → create_resource → replace
// vers la fiche fraîche.

import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, TextArea, View, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import {
  ResourceFilePicker,
  type PickedFile,
} from '@/features/cours/components/ResourceFilePicker';
import { useCourseLevels, useCourseSubjects } from '@/features/cours/hooks/useCourseTaxonomy';
import { useCreateResource } from '@/features/cours/hooks/useCreateResource';
import { RESOURCE_TYPES } from '@/features/cours/hooks/useResources';
import { SegmentedChoice } from '@/features/marketplace/components/SegmentedChoice';
import { useTranslations, type Translations } from '@/i18n';
import { logger } from '@/lib/logger';
import { uploadResourceFile } from '@/lib/storage';

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_FILES = 5;

const TypeEnum = z.enum(['cours', 'fiche_revision', 'exercices', 'annale']);

// Schéma construit avec `t` pour que les messages de validation soient traduits.
function buildResourceSchema(t: Translations) {
  const e = t.cours.create.errors;
  return z.object({
    type: TypeEnum,
    levelCode: z.string().min(1, e.levelRequired),
    subjectCode: z.string().min(1, e.subjectRequired),
    title: z.string().trim().min(3, e.titleMin).max(MAX_TITLE, e.maxChars(MAX_TITLE)),
    description: z.string().trim().max(MAX_DESCRIPTION, e.maxChars(MAX_DESCRIPTION)).optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildResourceSchema>>;

export default function CreateResourceScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const createResource = useCreateResource();
  const levelsQuery = useCourseLevels();
  const subjectsQuery = useCourseSubjects();

  const [files, setFiles] = useState<PickedFile[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const resourceSchema = useMemo(() => buildResourceSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      type: 'cours',
      levelCode: '',
      subjectCode: '',
      title: '',
      description: '',
    },
    mode: 'onSubmit',
  });

  const levelOptions = useMemo(
    () => (levelsQuery.data ?? []).map((l) => ({ value: l.code, label: l.label })),
    [levelsQuery.data]
  );
  const subjectOptions = useMemo(
    () => (subjectsQuery.data ?? []).map((s) => ({ value: s.code, label: s.label })),
    [subjectsQuery.data]
  );
  const typeOptions = useMemo(
    () => RESOURCE_TYPES.map((rt) => ({ value: rt, label: t.cours.resourceType[rt] })),
    [t]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const handleClose = useCallback(() => {
    Alert.alert(t.cours.create.discardTitle, t.cours.create.discardMessage, [
      { text: t.cours.create.discardKeepEditing, style: 'cancel' },
      { text: t.cours.create.discardConfirm, style: 'destructive', onPress: handleBack },
    ]);
  }, [handleBack, t]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (files.length === 0) {
        setFilesError(t.cours.create.errors.filesRequired);
        return;
      }
      setFilesError(null);

      try {
        setUploadProgress({ done: 0, total: files.length });
        const publicUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (!f) continue;
          const result = await uploadResourceFile(f.uri, {
            mimeType: f.mimeType,
            name: f.name,
          });
          publicUrls.push(result.publicUrl);
          setUploadProgress({ done: i + 1, total: files.length });
        }
        setUploadProgress(null);

        const newId = await createResource.mutateAsync({
          type: values.type,
          levelCode: values.levelCode,
          subjectCode: values.subjectCode,
          title: values.title.trim(),
          description: values.description?.trim() || null,
          files: publicUrls,
        });

        router.replace(`/cours/${newId}`);
      } catch (err) {
        setUploadProgress(null);
        const message = err instanceof Error ? err.message : t.cours.create.submitErrorFallback;
        logger.warn('create_resource submit failed', { message });
        Alert.alert(t.cours.create.submitErrorTitle, message);
      }
    },
    [createResource, files, t]
  );

  const isBusy = isSubmitting || createResource.isPending || uploadProgress !== null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View flex={1} backgroundColor="$background" paddingTop={insets.top}>
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
              onPress={handleClose}
              disabled={isBusy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t.cours.common.cancel}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text flex={1} color="$color" fontSize={18} fontWeight="700">
              {t.cours.create.title}
            </Text>
          </XStack>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Type */}
            <Section title={t.cours.create.sections.type} required>
              <Controller
                control={control}
                name="type"
                render={({ field: { value, onChange } }) => (
                  <SegmentedChoice
                    options={typeOptions}
                    value={value}
                    onChange={onChange}
                    disabled={isBusy}
                  />
                )}
              />
            </Section>

            {/* Niveau */}
            <Section title={t.cours.create.sections.level} required>
              <Controller
                control={control}
                name="levelCode"
                render={({ field: { value, onChange } }) => (
                  <ChipRow
                    options={levelOptions}
                    value={value}
                    onChange={onChange}
                    disabled={isBusy}
                  />
                )}
              />
              {errors.levelCode ? <ErrorText>{errors.levelCode.message}</ErrorText> : null}
            </Section>

            {/* Matière */}
            <Section title={t.cours.create.sections.subject} required>
              <Controller
                control={control}
                name="subjectCode"
                render={({ field: { value, onChange } }) => (
                  <ChipRow
                    options={subjectOptions}
                    value={value}
                    onChange={onChange}
                    disabled={isBusy}
                  />
                )}
              />
              {errors.subjectCode ? <ErrorText>{errors.subjectCode.message}</ErrorText> : null}
            </Section>

            {/* Titre */}
            <Section title={t.cours.create.sections.title} required>
              <Controller
                control={control}
                name="title"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t.cours.create.titlePlaceholder}
                    placeholderTextColor="$placeholderColor"
                    maxLength={MAX_TITLE}
                    editable={!isBusy}
                    color="$color"
                    backgroundColor="$surface"
                    borderWidth={0}
                    borderRadius="$md"
                    height={48}
                    paddingHorizontal={14}
                    accessibilityLabel={t.cours.create.titleA11y}
                  />
                )}
              />
              {errors.title ? <ErrorText>{errors.title.message}</ErrorText> : null}
            </Section>

            {/* Description */}
            <Section title={t.cours.create.sections.description} subtitle={t.cours.create.optional}>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextArea
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t.cours.create.descriptionPlaceholder}
                    placeholderTextColor="$placeholderColor"
                    maxLength={MAX_DESCRIPTION}
                    editable={!isBusy}
                    color="$color"
                    backgroundColor="$surface"
                    borderWidth={0}
                    borderRadius="$md"
                    minHeight={110}
                    paddingHorizontal={14}
                    paddingTop={12}
                    textAlignVertical="top"
                    accessibilityLabel={t.cours.create.descriptionA11y}
                  />
                )}
              />
            </Section>

            {/* Fichiers */}
            <Section title={t.cours.create.sections.files} required>
              <ResourceFilePicker
                files={files}
                onChange={(next) => {
                  setFiles(next);
                  if (next.length > 0) setFilesError(null);
                }}
                maxFiles={MAX_FILES}
                disabled={isBusy}
              />
              {filesError ? <ErrorText>{filesError}</ErrorText> : null}
            </Section>

            {uploadProgress ? (
              <Text fontSize={12} color="$textSecondary" textAlign="center" marginTop={8}>
                {t.cours.create.uploadProgress(uploadProgress.done, uploadProgress.total)}
              </Text>
            ) : null}
          </ScrollView>

          {/* CTA */}
          <YStack
            paddingHorizontal={16}
            paddingTop={12}
            paddingBottom={insets.bottom + 12}
            backgroundColor="$background"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderColor"
          >
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={t.cours.create.submitA11y}
              accessibilityState={{ disabled: isBusy }}
              style={[styles.cta, { backgroundColor: isBusy ? '#1A1A1A' : '#10D970' }]}
            >
              {isBusy ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color="#000000">
                  {t.cours.create.submitCta}
                </Text>
              )}
            </Pressable>
          </YStack>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// Rangée de chips scrollable pour un choix REQUIS (pas d'option "tout").
function ChipRow({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipRowContent}
      style={styles.chipRow}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => !disabled && onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled }}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text
              fontSize={13}
              fontWeight={active ? '700' : '500'}
              color={active ? '#000000' : '#FFFFFF'}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Section({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <YStack gap={10} marginTop={20}>
      <XStack alignItems="baseline" gap={6}>
        <Text fontSize={14} fontWeight="700" color="$color">
          {title}
        </Text>
        {required ? (
          <Text fontSize={12} color="#10D970" fontWeight="700">
            *
          </Text>
        ) : null}
        {subtitle ? (
          <Text fontSize={11} color="$textSecondary">
            · {subtitle}
          </Text>
        ) : null}
      </XStack>
      {children}
    </YStack>
  );
}

function ErrorText({ children }: { children: string | undefined }) {
  if (!children) return null;
  return (
    <Text fontSize={12} color="#FF6B6B" marginTop={4}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
  },
  chipRow: {
    flexGrow: 0,
  },
  chipRowContent: {
    paddingRight: 4,
  },
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
